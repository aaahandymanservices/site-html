import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookings, seasonalSubscribers } from "../../db/schema.js";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
    let photo: File | null = null;

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
      const uploadedPhoto = formData.get("photo");
      photo = uploadedPhoto instanceof File && uploadedPhoto.size > 0 ? uploadedPhoto : null;
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

    if (photo && photo.size > MAX_IMAGE_SIZE) {
      return errorJson("The repair photo must be 5 MB or smaller.", 400);
    }

    if (photo && !IMAGE_TYPES.has(photo.type)) {
      return errorJson("Upload a JPG, PNG, or WebP repair photo.", 400);
    }

    let photoKey: string | null = null;
    const photoStore = getStore("booking-repair-photos");

    if (photo) {
      const extension = photo.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      photoKey = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
      await photoStore.set(photoKey, await photo.arrayBuffer());
    }

    let newBooking: typeof bookings.$inferSelect;
    try {
      [newBooking] = await db.insert(bookings).values({
        customerName,
        email,
        phone,
        service,
        bookingDate,
        bookingTime,
        message: message || null,
        photoKey,
        status: "pending"
      }).returning();
    } catch (error) {
      if (photoKey) {
        await photoStore.delete(photoKey).catch(() => undefined);
      }
      throw error;
    }

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
        bookingTime: newBooking.bookingTime,
        photoUrl: newBooking.photoKey ? `/api/booking/photo/${newBooking.photoKey}` : null
      }
    }, { status: 201 });
  } catch (err: any) {
    return errorJson(err.message || "Failed to submit booking. Please try again soon.", 500);
  }
};

export const config: Config = {
  path: "/api/booking",
};
