import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { homeCareSubscriptions } from "../../db/schema.js";
import { resolveServiceLocation } from "../lib/service-area.js";

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });

const errorJson = (message = "Something went wrong on our end. Please try again in a moment, or call us at (248) 385-3432.", status = 500) =>
  json({ error: message }, { status });

/*
 * The plan catalogue lives here rather than in the page, because the price that
 * gets written to `quoted_price` has to be the one we published -- not whatever
 * a form field happened to contain. The Services page renders the same numbers
 * (scripts/js/home-care-plans.js); if these change, change both.
 *
 * Annual is ten months' price: pay for the year, get two months free.
 */
const PLANS = {
  essential: { name: "Essential", monthly: 39, annual: 390 },
  complete: { name: "Complete", monthly: 59, annual: 590 },
  "complete-plus": { name: "Complete Plus", monthly: 89, annual: 890 },
} as const;

type PlanSlug = keyof typeof PLANS;

const isPlanSlug = (value: string): value is PlanSlug => Object.prototype.hasOwnProperty.call(PLANS, value);

const MAX_NOTES_LENGTH = 700;
const MAX_ADDRESS_LENGTH = 160;
const MAX_CITY_LENGTH = 80;
const MAX_NAME_LENGTH = 120;

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        allow: "POST, OPTIONS",
      },
    });
  }

  if (request.method !== "POST") {
    return errorJson("Method not allowed", 405);
  }

  try {
    let customerName = "";
    let email = "";
    let phone = "";
    let address = "";
    let city = "";
    let zip = "";
    let plan = "";
    let billingCycle = "";
    let notes = "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      customerName = String(body.customerName || body.name || "").trim();
      email = String(body.email || "").trim().toLowerCase();
      phone = String(body.phone || "").trim();
      address = String(body.address || "").trim();
      city = String(body.city || "").trim();
      zip = String(body.zip || body.zipCode || "").trim();
      plan = String(body.plan || "").trim().toLowerCase();
      billingCycle = String(body.billingCycle || body["billing-cycle"] || "monthly").trim().toLowerCase();
      notes = String(body.notes || body.message || "").trim();
    } else {
      const formData = await request.formData();
      customerName = String(formData.get("customerName") || formData.get("name") || "").trim();
      email = String(formData.get("email") || "").trim().toLowerCase();
      phone = String(formData.get("phone") || "").trim();
      address = String(formData.get("address") || "").trim();
      city = String(formData.get("city") || "").trim();
      zip = String(formData.get("zip") || formData.get("zipCode") || "").trim();
      plan = String(formData.get("plan") || "").trim().toLowerCase();
      billingCycle = String(formData.get("billingCycle") || formData.get("billing-cycle") || "monthly").trim().toLowerCase();
      notes = String(formData.get("notes") || formData.get("message") || "").trim();
    }

    if (!customerName || !email || !phone || !plan) {
      return errorJson("Please provide your name, email, phone number, and the plan you'd like.", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorJson("Please provide a valid email address.", 400);
    }

    if (phone.replace(/\D/g, "").length < 10) {
      return errorJson("Please provide a valid 10-digit phone number.", 400);
    }

    if (!isPlanSlug(plan)) {
      return errorJson("Please choose one of the Quarterly Home Care Plans.", 400);
    }

    if (billingCycle !== "monthly" && billingCycle !== "annual") {
      billingCycle = "monthly";
    }

    // A recurring plan is a standing appointment, so unlike a one-off booking
    // the address is not optional: we cannot schedule quarterly visits to a
    // house we cannot place on a route.
    const location = resolveServiceLocation(zip);
    if (!location) {
      return errorJson("Please provide the 5-digit ZIP code of the home you'd like on the plan.", 400);
    }
    if (!location.served) {
      return errorJson(
        "That ZIP code is outside our Oakland County service area, so we can't schedule quarterly visits there. Call us at (248) 385-3432 and we'll point you in the right direction.",
        400,
      );
    }

    const quotedPrice = billingCycle === "annual" ? PLANS[plan].annual : PLANS[plan].monthly;

    // Signing up twice -- a second tab, an impatient double-tap, or a change of
    // mind a week later -- should not leave the owner with two plans to call
    // about. The newest pending request for an address wins and replaces the
    // one before it.
    const [pending] = await db
      .select()
      .from(homeCareSubscriptions)
      .where(eq(homeCareSubscriptions.email, email))
      .orderBy(desc(homeCareSubscriptions.createdAt))
      .limit(1);

    const values = {
      customerName: customerName.slice(0, MAX_NAME_LENGTH),
      email,
      phone,
      address: address.slice(0, MAX_ADDRESS_LENGTH) || null,
      city: (location.city || city).slice(0, MAX_CITY_LENGTH) || null,
      zip: location.zip,
      zone: location.zone || null,
      plan,
      billingCycle,
      quotedPrice,
      notes: notes.slice(0, MAX_NOTES_LENGTH) || null,
    };

    let subscription: typeof homeCareSubscriptions.$inferSelect;
    if (pending && pending.status === "pending") {
      [subscription] = await db
        .update(homeCareSubscriptions)
        .set(values)
        .where(eq(homeCareSubscriptions.id, pending.id))
        .returning();
    } else {
      [subscription] = await db
        .insert(homeCareSubscriptions)
        .values({ ...values, status: "pending" })
        .returning();
    }

    return json(
      {
        message: `You're on the list for the ${PLANS[plan].name} plan. Victor will call within one business day to confirm your first quarterly visit and set up billing — nothing is charged until you say go.`,
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          planName: PLANS[plan].name,
          billingCycle: subscription.billingCycle,
          quotedPrice: subscription.quotedPrice,
          city: subscription.city,
          zone: subscription.zone,
        },
        serviceArea: {
          city: location.city,
          zone: location.zone,
          route: location.route,
          routeLabel: location.routeLabel,
          routeDays: location.routeDays,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    return errorJson(
      err.message || "We couldn't save your plan request just now. Please try again, or call us at (248) 385-3432.",
      500,
    );
  }
};

export const config: Config = {
  path: "/api/home-care-subscription",
};
