import type { Config } from "@netlify/functions";
import { eq, and, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { homeMaintenanceMemberships } from "../../db/schema.js";

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });

const errorJson = (message = "Something went wrong. Please try again soon.", status = 500) =>
  json({ error: message }, { status });

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        allow: "GET, POST, OPTIONS",
      },
    });
  }

  // GET: Retrieve memberships or get notices
  if (request.method === "GET") {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get("action");

      // Handle the 30-day notice check action
      if (action === "notices") {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        // Fetch all active memberships where nextMaintenanceDate is between today and 30 days from now
        const activeMemberships = await db
          .select()
          .from(homeMaintenanceMemberships)
          .where(
            and(
              eq(homeMaintenanceMemberships.status, "active"),
              sql`${homeMaintenanceMemberships.nextMaintenanceDate} >= NOW()`,
              sql`${homeMaintenanceMemberships.nextMaintenanceDate} <= NOW() + INTERVAL '30 days'`
            )
          );

        // For simulation/response, represent the 30-day notices needed
        const notices = activeMemberships.map((m) => {
          const maintenanceDate = new Date(m.nextMaintenanceDate);
          const daysRemaining = Math.ceil(
            (maintenanceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            id: m.id,
            customerName: m.customerName,
            email: m.email,
            purchaseDate: m.purchaseDate,
            nextMaintenanceDate: m.nextMaintenanceDate,
            daysRemaining,
            noticeSubject: "30-Day Notice: Annual Home Maintenance Checkup",
            noticeBody: `Hi ${m.customerName},\n\nThis is your 30-day notice that your annual Home Maintenance Membership tune-up visit is approaching on ${maintenanceDate.toLocaleDateString()}.\n\nPlease call us at (248) 385-3432 or email contact@aaahandyman.services to schedule your visit.\n\nBest regards,\nVictor Gregg Hale\nAAA Handyman Services`,
          };
        });

        return json({
          success: true,
          totalNoticesNeeded: notices.length,
          notices,
        });
      }

      // Default: list all memberships
      const memberships = await db
        .select()
        .from(homeMaintenanceMemberships)
        .orderBy(homeMaintenanceMemberships.createdAt);

      return json({ success: true, memberships });
    } catch (err: any) {
      return errorJson(err.message || "Failed to fetch memberships.", 500);
    }
  }

  // POST: Create or Register a Membership
  if (request.method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const customerName = String(body.customerName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      
      if (!customerName || !email) {
        return errorJson("Customer name and email are required to register a membership.", 400);
      }

      // Basic email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return errorJson("Please provide a valid email address.", 400);
      }

      // Determine next maintenance date:
      // Membership starts on purchaseDate (default today) and first maintenance visit is typically
      // scheduled or notified. We default nextMaintenanceDate to 1 year (or 6 months, let's make it 6 months or 1 year)
      // Since it's annual membership with two visits, let's schedule next maintenance visit 6 months from purchase date.
      const purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : new Date();
      const nextMaintenanceDate = body.nextMaintenanceDate 
        ? new Date(body.nextMaintenanceDate) 
        : new Date(purchaseDate.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 months (180 days)

      const [newMembership] = await db
        .insert(homeMaintenanceMemberships)
        .values({
          customerName,
          email,
          purchaseDate,
          nextMaintenanceDate,
          status: "active",
        })
        .returning();

      return json({
        success: true,
        message: "Successfully registered Home Maintenance Membership!",
        membership: newMembership,
      }, { status: 201 });
    } catch (err: any) {
      return errorJson(err.message || "Failed to register membership.", 500);
    }
  }

  return errorJson("Method not allowed", 405);
};

export const config: Config = {
  path: "/api/membership",
};
