import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { seasonalSubscribers } from "../../db/schema.js";

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
    let email = "";
    let name = "";
    let source = "quote_form";

    // Handle JSON or URLSearchParams (standard form POST or application/json)
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      email = String(body.email || "").trim().toLowerCase();
      name = String(body.name || "").trim();
      source = String(body.source || "quote_form").trim();
    } else {
      const formData = await request.formData();
      email = String(formData.get("email") || "").trim().toLowerCase();
      name = String(formData.get("name") || "").trim();
      source = String(formData.get("source") || "quote_form").trim();
    }

    if (!email) {
      return errorJson("An email address is required.", 400);
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorJson("Please provide a valid email address.", 400);
    }

    // Try to see if they are already subscribed
    const existing = await db
      .select()
      .from(seasonalSubscribers)
      .where(eq(seasonalSubscribers.email, email))
      .limit(1);

    if (existing.length > 0) {
      if (!existing[0].optIn) {
        // Re-enable opt-in if they opted back in
        await db
          .update(seasonalSubscribers)
          .set({ optIn: true, name: name || existing[0].name })
          .where(eq(seasonalSubscribers.email, email));
        return json({ message: "Thank you for subscribing to our seasonal maintenance reminders!" });
      }
      return json({ message: "You are already subscribed to our seasonal maintenance reminders!" });
    }

    // Insert new subscription
    await db.insert(seasonalSubscribers).values({
      email,
      name: name || null,
      source,
      optIn: true,
    });

    return json({ message: "Successfully subscribed to seasonal reminders!" }, { status: 201 });
  } catch (err: any) {
    return errorJson(err.message || "Failed to process subscription.", 500);
  }
};

export const config: Config = {
  path: "/api/seasonal-subscription",
};
