import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookings, seasonalSubscribers } from "../../db/schema.js";
import {
  getRedemptionStatus,
  isCertificateRequested,
  recordRedemption,
  releaseRedemption,
} from "../lib/gift-certificate.js";
import { resolveServiceLocation } from "../lib/service-area.js";
import { WRONG_METHOD_MESSAGE } from "../lib/messages.js";
import {
  SPAM_REJECTED_MESSAGE,
  isSpamSubmission,
  spamFieldsFromForm,
  spamFieldsFromJson,
  type SpamFields,
} from "../lib/spam-guard.js";

// The visitor may pick any photo up to the site-wide 10 MB (see
// scripts/js/photo-upload.js); book-page.js resizes anything larger before it
// is sent. This is the transport backstop under Netlify's 6 MB buffered
// request cap, not the ceiling shown on the form.
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_ADDRESS_LENGTH = 160;
const MAX_CITY_LENGTH = 80;

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
    return errorJson(WRONG_METHOD_MESSAGE, 405);
  }

  try {
    let customerName = "";
    let email = "";
    let phone = "";
    let service = "";
    let bookingDate = "";
    let bookingTime = "";
    let message = "";
    let address = "";
    let city = "";
    let zip = "";
    let optIn = false;
    let giftCertificateRequested = false;
    let photo: File | null = null;
    // Filled from whichever body shape arrived, then checked once below.
    let spamFields: SpamFields;

    // Handle JSON or URLSearchParams (standard form POST or application/json)
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      spamFields = spamFieldsFromJson(body);
      customerName = String(body.customerName || body.name || "").trim();
      email = String(body.email || "").trim().toLowerCase();
      phone = String(body.phone || "").trim();
      service = String(body.service || "").trim();
      bookingDate = String(body.bookingDate || "").trim();
      bookingTime = String(body.bookingTime || "").trim();
      message = String(body.message || "").trim();
      address = String(body.address || "").trim();
      city = String(body.city || "").trim();
      zip = String(body.zip || body.zipCode || "").trim();
      optIn = Boolean(body.optIn || body["seasonal-opt-in"] || false);
      giftCertificateRequested = isCertificateRequested(
        body.firstServiceGiftCertificate ?? body["first-service-gift-certificate"],
      );
    } else {
      const formData = await request.formData();
      spamFields = spamFieldsFromForm(formData);
      customerName = String(formData.get("customerName") || formData.get("name") || "").trim();
      email = String(formData.get("email") || "").trim().toLowerCase();
      phone = String(formData.get("phone") || "").trim();
      service = String(formData.get("service") || "").trim();
      bookingDate = String(formData.get("bookingDate") || "").trim();
      bookingTime = String(formData.get("bookingTime") || "").trim();
      message = String(formData.get("message") || "").trim();
      address = String(formData.get("address") || "").trim();
      city = String(formData.get("city") || "").trim();
      zip = String(formData.get("zip") || formData.get("zipCode") || "").trim();
      optIn = formData.get("seasonal-opt-in") === "on" || formData.get("seasonal-opt-in") === "true";
      giftCertificateRequested = isCertificateRequested(
        formData.get("firstServiceGiftCertificate") ?? formData.get("first-service-gift-certificate"),
      );
      const uploadedPhoto = formData.get("photo");
      photo = uploadedPhoto instanceof File && uploadedPhoto.size > 0 ? uploadedPhoto : null;
    }

    // Before any of the work: the booking form renders a honeypot and a
    // reCAPTCHA widget, and until now this function read neither of them.
    if (await isSpamSubmission(spamFields, request)) {
      return errorJson(SPAM_REJECTED_MESSAGE, 400);
    }

    if (!customerName || !email || !phone || !service || !bookingDate || !bookingTime) {
      return errorJson("Please fill in the highlighted fields.", 400);
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
      return errorJson("The earliest date we can book is tomorrow. Please choose another day.", 400);
    }

    if (parsedBookingDate.getUTCDay() === 0) {
      return errorJson("AAA Handyman Services LLC is closed on Sundays. Please choose a Monday–Saturday date.", 400);
    }

    // Address is optional so the owner can still key in a phone booking that has
    // nothing but a name and a number, but a ZIP that *is* supplied has to be one
    // we drive to -- otherwise the appointment is confirmed for a house outside
    // the service area and someone finds out on the morning of the visit.
    const location = zip ? resolveServiceLocation(zip) : null;
    if (zip && !location) {
      return errorJson("Please provide a valid 5-digit ZIP code.", 400);
    }
    if (location && !location.served) {
      return errorJson(
        "That ZIP code is outside our Oakland County service area. Call us at (248) 385-3432 and we'll let you know if we can make the trip.",
        400,
      );
    }
    address = address.slice(0, MAX_ADDRESS_LENGTH);
    // A ZIP we recognise names its own city, which beats a typo in the city
    // field; anything the customer typed is only kept when we have nothing better.
    city = (location?.city || city).slice(0, MAX_CITY_LENGTH);

    if (photo && photo.size > MAX_IMAGE_SIZE) {
      return errorJson("That repair photo was too large to send. Please choose a smaller one, or submit without it.", 400);
    }

    if (photo && !IMAGE_TYPES.has(photo.type)) {
      return errorJson("Upload a JPG, PNG, WebP or GIF repair photo.", 400);
    }

    let photoKey: string | null = null;
    const photoStore = getStore("booking-repair-photos");

    if (photo) {
      const extension = photo.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      photoKey = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
      await photoStore.set(photoKey, await photo.arrayBuffer());
    }

    // The $50 first-service certificate is one per customer, ever. Claim it
    // before the booking is written so the UNIQUE constraint on the redemption
    // table -- not the browser -- decides whether this booking gets it, and two
    // simultaneous submissions from the same address can't both win. A request
    // that ticks the box after having already spent it is downgraded to a plain
    // booking rather than rejected. If the bookkeeping itself fails, the booking
    // still goes through without the discount: an appointment is worth more than
    // a promo flag, and the owner can honour the certificate by hand.
    let giftStatus = { firstServiceGiftRedeemed: false, redeemedAt: null as string | null, alreadyRedeemed: false };
    let giftCertificateApplied = false;
    try {
      if (giftCertificateRequested) {
        giftStatus = await recordRedemption(email, { customerName, source: "booking_form" });
        giftCertificateApplied = !giftStatus.alreadyRedeemed;
      } else {
        const status = await getRedemptionStatus(email);
        giftStatus = { ...status, alreadyRedeemed: status.firstServiceGiftRedeemed };
      }
    } catch (giftErr) {
      console.error("Failed to resolve the first-service gift certificate:", giftErr);
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
        address: address || null,
        city: city || null,
        zip: location ? location.zip : null,
        zone: location?.zone || null,
        giftCertificateApplied,
        status: "pending"
      }).returning();
    } catch (error) {
      if (photoKey) {
        await photoStore.delete(photoKey).catch(() => undefined);
      }
      // Hand the certificate back: it was claimed for a booking that never saved.
      if (giftCertificateApplied) {
        await releaseRedemption(email).catch(() => undefined);
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
      // Deliberately not "successfully booked": the whole flow is a request, the
      // submit button says so, and the confirmation screen says so. Promising a
      // confirmed appointment here only creates something to walk back on the call.
      message: "Request received. Victor will call or text within one business day to lock in your arrival window.",
      booking: {
        id: newBooking.id,
        customerName: newBooking.customerName,
        service: newBooking.service,
        bookingDate: newBooking.bookingDate,
        bookingTime: newBooking.bookingTime,
        city: newBooking.city,
        zone: newBooking.zone,
        giftCertificateApplied: newBooking.giftCertificateApplied,
        photoUrl: newBooking.photoKey ? `/api/booking/photo/${newBooking.photoKey}` : null
      },
      // Echoed back so the confirmation screen can name the route the address
      // falls on ("Wednesdays & Saturdays") instead of a generic thank-you.
      serviceArea: location
        ? { city: location.city, zone: location.zone, route: location.route, routeLabel: location.routeLabel, routeDays: location.routeDays }
        : null,
      // The browser mirrors this into local storage so the offer stops being
      // rendered for this visitor on every page.
      giftCertificate: {
        requested: giftCertificateRequested,
        applied: giftCertificateApplied,
        firstServiceGiftRedeemed: giftStatus.firstServiceGiftRedeemed,
        redeemedAt: giftStatus.redeemedAt
      }
    }, { status: 201 });
  } catch (err) {
    console.error("booking submission failed", err);
    return errorJson("We couldn't save your booking just now. Please try again, or call us at (248) 385-3432 and we'll book you over the phone.", 500);
  }
};

export const config: Config = {
  path: "/api/booking",
};
