import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookings, seasonalSubscribers } from "../../db/schema.js";

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

const getDetroitDateString = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getTomorrowInDetroit = () => {
  const today = getDetroitDateString(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1, 12));
  return tomorrow.toISOString().slice(0, 10);
};

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
    let service = "";
    let bookingDate = "";
    let bookingTime = "";
    let message = "";
    let optIn = false;

    // Handle JSON or URLSearchParams (standard form POST or application/json)
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      customerName = String(body.customerName || body.name || "").trim();
      email = String(body.email || "").trim().toLowerCase();
      phone = String(body.phone || "").trim();
      service = String(body.service || "").trim();
      bookingDate = String(body.bookingDate || "").trim();
      bookingTime = String(body.bookingTime || "").trim();
      message = String(body.message || "").trim();
      optIn = Boolean(body.optIn || body["seasonal-opt-in"] || false);
    } else {
      const formData = await request.formData();
      customerName = String(formData.get("customerName") || formData.get("name") || "").trim();
      email = String(formData.get("email") || "").trim().toLowerCase();
      phone = String(formData.get("phone") || "").trim();
      service = String(formData.get("service") || "").trim();
      bookingDate = String(formData.get("bookingDate") || "").trim();
      bookingTime = String(formData.get("bookingTime") || "").trim();
      message = String(formData.get("message") || "").trim();
      optIn = formData.get("seasonal-opt-in") === "on" || formData.get("seasonal-opt-in") === "true";
    }

    if (!customerName || !email || !phone || !service || !bookingDate || !bookingTime) {
      return errorJson("Please fill out all required fields.", 400);
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorJson("Please provide a valid email address.", 400);
    }

    // Basic phone validation (at least 10 digits)
    const phoneClean = phone.replace(/\D/g, "");
    if (phoneClean.length < 10) {
      return errorJson("Please provide a valid 10-digit phone number.", 400);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return errorJson("Please provide a valid booking date.", 400);
    }

    const parsedBookingDate = new Date(`${bookingDate}T12:00:00Z`);
    if (Number.isNaN(parsedBookingDate.getTime()) || parsedBookingDate.toISOString().slice(0, 10) !== bookingDate) {
      return errorJson("Please provide a valid booking date.", 400);
    }

    if (bookingDate < getTomorrowInDetroit()) {
      return errorJson("Booking requests must be scheduled at least one day in advance.", 400);
    }

    if (parsedBookingDate.getUTCDay() === 0) {
      return errorJson("AAA Handyman Services is closed on Sundays. Please choose a Monday–Saturday date.", 400);
    }

    // Insert new booking request
    const [newBooking] = await db.insert(bookings).values({
      customerName,
      email,
      phone,
      service,
      bookingDate,
      bookingTime,
      message: message || null,
      status: "pending"
    }).returning();

    // Proactively handle seasonal newsletter opt-in if checked
    if (optIn) {
      try {
        const existing = await db
          .select()
          .from(seasonalSubscribers)
          .where(eq(seasonalSubscribers.email, email))
          .limit(1);

        if (existing.length > 0) {
          if (!existing[0].optIn) {
            await db
              .update(seasonalSubscribers)
              .set({ optIn: true, name: customerName || existing[0].name })
              .where(eq(seasonalSubscribers.email, email));
          }
        } else {
          await db.insert(seasonalSubscribers).values({
            email,
            name: customerName || null,
            source: "booking_form",
            optIn: true,
          });
        }
      } catch (subErr) {
        console.error("Failed to automatically opt-in user during booking:", subErr);
      }
    }

    return json({
      message: "Successfully booked! We will contact you shortly to confirm your appointment details.",
      booking: {
        id: newBooking.id,
        customerName: newBooking.customerName,
        service: newBooking.service,
        bookingDate: newBooking.bookingDate,
        bookingTime: newBooking.bookingTime
      }
    }, { status: 201 });
  } catch (err: any) {
    return errorJson(err.message || "Failed to submit booking. Please try again soon.", 500);
  }
};

export const config: Config = {
  path: "/api/booking",
};
