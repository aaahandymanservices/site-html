import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contactRequests, seasonalSubscribers } from "../../db/schema.js";
import { isCertificateRequested } from "../lib/gift-certificate.js";
import { WRONG_METHOD_MESSAGE } from "../lib/messages.js";

/*
 * Receives the /contact "Request a free quote" form. The form posts as
 * multipart/form-data so it can carry up to five repair photos alongside the
 * text fields. Each photo is validated, stored in Netlify Blobs under a unique
 * key, and the keys are written to the new contact_requests row so the owner
 * can see the scope before calling the customer back.
 *
 * Netlify caps a buffered function request/response at 6 MB. What the visitor
 * is allowed to pick is the site-wide rule -- JPG, PNG, WebP or GIF at 10 MB
 * each -- and the browser resizes anything larger before sending it (see
 * contact-page.js and photo-upload.js). MAX_IMAGE_SIZE below is therefore a
 * backstop against a request that skipped that step, not the ceiling the
 * customer was shown, and it sits under the platform limit to leave room for
 * five photos plus the text fields and the multipart boundaries.
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PHOTOS = 5;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// Files dragged from a file manager sometimes arrive without a recognised MIME
// type, so the extension is the fallback signal that the file is one we accept.
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;
const MAX_MESSAGE_LENGTH = 8000;
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

const clean = (value: string, maxLength: number) =>
  value.replace(/\s+/g, " ").trim().slice(0, maxLength);

const extensionFor = (file: File) => {
  const fromType = file.type.split("/")[1]?.toLowerCase();
  if (fromType === "jpeg") return "jpg";
  if (fromType === "png") return "png";
  if (fromType === "webp") return "webp";
  if (fromType === "gif") return "gif";
  const match = file.name.match(IMAGE_EXTENSIONS);
  return match ? match[1].replace("jpeg", "jpg").toLowerCase() : "jpg";
};

const isValidImage = (file: File) =>
  IMAGE_TYPES.has(file.type) || IMAGE_EXTENSIONS.test(file.name);

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { allow: "POST, OPTIONS" },
    });
  }

  if (request.method !== "POST") {
    return errorJson(WRONG_METHOD_MESSAGE, 405);
  }

  try {
    const formData = await request.formData();

    const customerName = clean(String(formData.get("name") || ""), 120);
    const email = clean(String(formData.get("email") || ""), 160).toLowerCase();
    const phone = clean(String(formData.get("phone") || ""), 40);
    const city = clean(String(formData.get("city") || ""), MAX_CITY_LENGTH);
    const service = clean(String(formData.get("service") || ""), 80);
    const message = clean(String(formData.get("message") || ""), MAX_MESSAGE_LENGTH);
    const seasonalOptIn = formData.get("seasonal-opt-in") === "on" || formData.get("seasonal-opt-in") === "true";
    const giftCertificateRequested = isCertificateRequested(
      formData.get("firstServiceGiftCertificate") ?? formData.get("first-service-gift-certificate"),
    );

    if (!customerName || !email || !phone || !service || !message) {
      return errorJson("Please fill in the highlighted fields.", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorJson("Please provide a valid email address.", 400);
    }

    const phoneClean = phone.replace(/\D/g, "");
    if (phoneClean.length < 10) {
      return errorJson("Please provide a valid 10-digit phone number.", 400);
    }

    if (message.length < 10) {
      return errorJson("Please tell us a little about the work — at least a sentence.", 400);
    }

    // Collect up to MAX_PHOTOS photos from photo1..photo5 form fields.
    const photos: File[] = [];
    for (let i = 1; i <= MAX_PHOTOS; i += 1) {
      const entry = formData.get(`photo${i}`);
      if (entry instanceof File && entry.size > 0) {
        photos.push(entry);
      }
    }

    if (photos.length > MAX_PHOTOS) {
      return errorJson(`Please attach no more than ${MAX_PHOTOS} photos.`, 400);
    }

    for (const photo of photos) {
      if (photo.size > MAX_IMAGE_SIZE) {
        return errorJson(`"${photo.name}" was too large to send. Please attach a smaller one, or email it to contact@aaahandyman.services.`, 400);
      }
      if (!isValidImage(photo)) {
        return errorJson(`"${photo.name}" is not a supported format. Please upload a JPG, PNG, WebP or GIF image.`, 400);
      }
    }

    // Store each photo in Netlify Blobs under a unique key. The key is the only
    // thing written to the row, so the storage layout stays an implementation
    // detail of this function and the photo-serving function below.
    const photoStore = getStore("contact-quote-photos");
    const photoKeys: (string | null)[] = [null, null, null, null, null];

    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i];
      const extension = extensionFor(photo);
      const key = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
      try {
        await photoStore.set(key, await photo.arrayBuffer());
        photoKeys[i] = key;
      } catch (storeErr) {
        console.error("contact photo store failed", storeErr);
        // The request still goes through without this photo: a quote with four
        // photos is worth more than no quote at all, and the owner can ask the
        // customer to re-send the missing one on the call.
      }
    }

    let newRequest: typeof contactRequests.$inferSelect;
    try {
      [newRequest] = await db.insert(contactRequests).values({
        customerName,
        email,
        phone,
        city: city || null,
        service,
        message,
        photoKey1: photoKeys[0],
        photoKey2: photoKeys[1],
        photoKey3: photoKeys[2],
        photoKey4: photoKeys[3],
        photoKey5: photoKeys[4],
        seasonalOptIn,
        giftCertificateRequested,
        status: "pending",
      }).returning();
    } catch (insertErr) {
      // Roll back any photos that were stored before the row write failed so
      // they don't pile up as orphans in the blob store.
      await Promise.all(
        photoKeys.filter(Boolean).map((key) => photoStore.delete(key!).catch(() => undefined)),
      );
      throw insertErr;
    }

    // Proactively handle seasonal newsletter opt-in if checked, mirroring the
    // booking form: a checked box on the contact form also subscribes the
    // visitor, so the owner does not have to add them by hand.
    if (seasonalOptIn) {
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
            source: "contact_form",
            optIn: true,
          });
        }
      } catch (subErr) {
        console.error("Failed to automatically opt-in user from contact form:", subErr);
      }
    }

    const photoUrls = photoKeys.filter(Boolean).map((key) => `/api/contact-quote/photo/${encodeURIComponent(key!)}`);

    return json({
      message: "Thank you! Your message is on its way and we will be in touch shortly.",
      request: {
        id: newRequest.id,
        customerName: newRequest.customerName,
        service: newRequest.service,
        photoUrls,
      },
    }, { status: 201 });
  } catch (err: any) {
    return errorJson(
      err.message || "We couldn't send your message just now. Please try again, or call us at (248) 385-3432 and we'll help right away.",
      500,
    );
  }
};

export const config: Config = {
  path: "/api/contact-quote",
};