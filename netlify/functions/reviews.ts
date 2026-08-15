import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { reviews } from "../../db/schema.js";
import { submittedPasscode, verifyAdminPasscode } from "../lib/admin-credential.js";
import { OWNER_SIGN_IN_UNAVAILABLE_MESSAGE, WRONG_METHOD_MESSAGE } from "../lib/messages.js";

// Netlify caps a buffered function request/response at 6 MB, so anything larger
// is rejected by the platform before this code runs. Staying under that ceiling
// keeps the failure a readable validation message instead of an opaque 413.
// The browser downscales bigger source photos before sending them.
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Strong consistency so a photo is readable the instant the upload responds and
// the page re-renders; the default eventual store can lag by up to a minute.
const photoStore = () => getStore({ name: "customer-reviews", consistency: "strong" });

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

const clean = (value: FormDataEntryValue | null, maxLength: number) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "customer-photo";

const idFromRequest = (request: Request) => {
  const id = Number.parseInt(new URL(request.url).pathname.replace("/api/reviews/", ""), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// The row stores only the blob key; the public path is derived here so the
// storage layout stays an implementation detail of this function. A row with no
// key yields an empty imageUrl rather than a dangling "/api/reviews/photo/",
// which the page would otherwise render as a broken image.
const publicPhotoPath = (imageKey: string | null | undefined) => {
  const key = String(imageKey ?? "").trim();
  return key ? `/api/reviews/photo/${encodeURIComponent(key)}` : "";
};

const publicReview = (review: typeof reviews.$inferSelect) => ({
  id: review.id,
  customerName: review.customerName,
  location: review.location,
  projectType: review.projectType,
  rating: review.rating,
  review: review.review,
  attributes: review.attributes
    ? review.attributes.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [],
  ownerResponse: review.ownerResponse ?? "",
  imageUrl: publicPhotoPath(review.imageKey),
  imageUrls: [review.imageKey, review.imageKey2, review.imageKey3]
    .map((key) => publicPhotoPath(key))
    .filter(Boolean),
  imageAlt: review.imageAlt,
  createdAt: review.createdAt,
});

// A curated allow-list keeps stored highlight tags tidy and prevents arbitrary
// text from being smuggled through the attribute chips.
const ALLOWED_ATTRIBUTES = new Set([
  "Punctual",
  "Clean Workspace",
  "Fair Pricing",
  "Great Communication",
  "Quality Work",
  "Friendly",
]);

const cleanAttributes = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => ALLOWED_ATTRIBUTES.has(tag))
    .slice(0, 6)
    .join(",");

const validateReviewFields = (customerName: string, location: string, projectType: string, review: string, rating: number) => {
  if (!customerName || !location || !projectType || !review || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return "Please complete every review field.";
  }

  return "";
};

// A review accepts up to three photos. The form sends them as `photo`
// (primary, required on a new review), `photo2`, and `photo3` -- optional
// extra angles. Older callers that only send `photo` keep working unchanged.
const PHOTO_FIELDS = ["photo", "photo2", "photo3"] as const;
const MAX_PHOTOS = 3;

const validatePhoto = (photo: FormDataEntryValue | null, required: boolean) => {
  if (!(photo instanceof File) || photo.size === 0) {
    return required ? "Please upload a project photo." : "";
  }

  if (photo.size > MAX_IMAGE_SIZE) {
    return "That photo is too large to upload. Please choose one 5 MB or smaller.";
  }

  if (!IMAGE_TYPES.has(photo.type)) {
    return "Upload a JPG, PNG, WebP, or GIF photo.";
  }

  return "";
};

// Pull the admin secret from the request: an X-Admin-Token header (preferred),
// an Authorization: Bearer header, or a JSON/query/form field carried through.
const submittedAdminSecret = (request: Request, fallback = "") => submittedPasscode(request, fallback);

// Authorization gate for any review mutation. Fails closed: if no admin
// credential is configured on the server, no one is allowed to edit or delete
// reviews. Verification lives in netlify/lib/admin-credential.ts, which prefers
// the salted ADMIN_API_TOKEN_HASH verifier over a plaintext secret.
const authorizeAdmin = (submitted: string): Response | null => {
  const result = verifyAdminPasscode(submitted);

  if (result.status === "not-configured") {
    console.error("No admin credential is configured; refusing review mutation.");
    return errorJson(OWNER_SIGN_IN_UNAVAILABLE_MESSAGE, 503);
  }

  if (result.status === "rejected") {
    return errorJson("Please sign in as the owner to edit or remove reviews.", 401);
  }

  return null;
};

const handleReviewsRequest = async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        allow: "GET, POST, PUT, DELETE, OPTIONS",
      },
    });
  }

  if (request.method === "GET") {
    const list = await db
      .select()
      .from(reviews)
      .orderBy(desc(reviews.createdAt))
      .limit(24);

    return json(list.map(publicReview));
  }

  if (request.method === "DELETE") {
    const id = idFromRequest(request);
    let bodyToken = "";
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      bodyToken = clean((body as { editToken?: string; adminToken?: string }).adminToken ?? (body as { editToken?: string }).editToken ?? null, 200);
    }
    if (!bodyToken) {
      const url = new URL(request.url);
      bodyToken = clean(url.searchParams.get("editToken") ?? url.searchParams.get("adminToken") ?? null, 200);
    }

    const authError = authorizeAdmin(submittedAdminSecret(request, bodyToken));
    if (authError) {
      return authError;
    }

    if (!id) {
      return errorJson("We couldn't remove that review. Please refresh and try again.", 400);
    }

    const [existing] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!existing) {
      return errorJson("We couldn't remove that review. Please refresh and try again.", 404);
    }

    await db.delete(reviews).where(eq(reviews.id, id));
    const store = photoStore();
    await Promise.all(
      [existing.imageKey, existing.imageKey2, existing.imageKey3]
        .filter((key): key is string => Boolean(key))
        .map((key) => store.delete(key).catch(() => undefined)),
    );

    return json({ ok: true });
  }

  if (request.method !== "POST" && request.method !== "PUT") {
    return errorJson(WRONG_METHOD_MESSAGE, 405);
  }

  const isUpdate = request.method === "PUT";
  const id = isUpdate ? idFromRequest(request) : null;
  const form = await request.formData();
  const customerName = clean(form.get("customerName"), 80);
  const location = clean(form.get("location"), 90);
  const projectType = clean(form.get("projectType"), 80);
  const review = clean(form.get("review"), 700);
  const rating = Number.parseInt(String(form.get("rating") ?? ""), 10);
  const attributes = cleanAttributes(form.get("attributes"));
  // Owner responses are only honored on the admin-authorized update path below.
  const ownerResponse = clean(form.get("ownerResponse"), 500);
  const formAdminToken = isUpdate ? clean(form.get("editToken") ?? form.get("adminToken"), 200) : "";

  const fieldError = validateReviewFields(customerName, location, projectType, review, rating);
  if (fieldError) {
    return errorJson(fieldError, 400);
  }

  // Collect the primary photo plus up to two optional extra angles. The form
  // sends them as `photo`, `photo2`, `photo3`. Each is validated the same way
  // the single photo used to be; the primary is required on a new review.
  const photoEntries = PHOTO_FIELDS.map((field) => form.get(field));
  const store = photoStore();
  // Every blob key written during this request, so a failure after the
  // writes can clean up every orphan rather than just the primary's.
  const storedKeys: string[] = [];
  const photos: File[] = [];
  for (const entry of photoEntries) {
    if (entry == null) continue;
    if (typeof entry === "string") continue;
    if (entry.size === 0) continue;
    photos.push(entry);
    if (photos.length > MAX_PHOTOS) {
      return errorJson("You can upload at most 3 photos.", 400);
    }
  }
  const photo = photos[0] ?? null;

  const photoError = validatePhoto(photo, !isUpdate);
  if (photoError) {
    return errorJson(photoError, 400);
  }
  for (let i = 1; i < photos.length; i += 1) {
    const extraError = validatePhoto(photos[i], false);
    if (extraError) {
      return errorJson(extraError, 400);
    }
  }

  // Store a photo in Netlify Blobs and return the key + content type it should
  // be recorded under. Keys carry the project slug so the blob is self-
  // describing in the store.
  const imageAlt = `${projectType} project photo from ${customerName} in ${location}`;
  const storePhoto = async (file: File) => {
    const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const key = `${Date.now()}-${crypto.randomUUID()}-${slug(projectType)}.${extension}`;
    await store.set(key, await file.arrayBuffer());
    storedKeys.push(key);
    return { key, contentType: file.type };
  };

  if (isUpdate) {
    const authError = authorizeAdmin(submittedAdminSecret(request, formAdminToken));
    if (authError) {
      return authError;
    }

    if (!id) {
      return errorJson("We couldn't update that review. Please refresh and try again.", 400);
    }

    const [existing] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!existing) {
      return errorJson("We couldn't update that review. Please refresh and try again.", 404);
    }

    let imageKey = existing.imageKey;
    let imageContentType = existing.imageContentType;
    let imageKey2 = existing.imageKey2;
    let imageContentType2 = existing.imageContentType2;
    let imageKey3 = existing.imageKey3;
    let imageContentType3 = existing.imageContentType3;
    // The blob key that each slot used to point at, when that slot is about to
    // be replaced. Only those are deleted afterwards -- the slots a customer
    // didn't re-upload keep their current blob.
    const replacedKeys: string[] = [];

    if (photos[0]) {
      if (existing.imageKey) replacedKeys.push(existing.imageKey);
      const stored = await storePhoto(photos[0]);
      imageKey = stored.key;
      imageContentType = stored.contentType;
    }
    if (photos[1]) {
      if (existing.imageKey2) replacedKeys.push(existing.imageKey2);
      const stored = await storePhoto(photos[1]);
      imageKey2 = stored.key;
      imageContentType2 = stored.contentType;
    }
    if (photos[2]) {
      if (existing.imageKey3) replacedKeys.push(existing.imageKey3);
      const stored = await storePhoto(photos[2]);
      imageKey3 = stored.key;
      imageContentType3 = stored.contentType;
    }

    const [updated] = await db
      .update(reviews)
      .set({ customerName, location, projectType, rating, review, attributes, ownerResponse, imageKey, imageContentType, imageKey2, imageContentType2, imageKey3, imageContentType3, imageAlt })
      .where(eq(reviews.id, id))
      .returning();

    // Drop the blobs for the slots that were replaced, now that the row points
    // at the new keys. Best-effort: a failed delete doesn't undo the update.
    await Promise.all(
      replacedKeys.map((key) => store.delete(key).catch(() => undefined)),
    );

    return json(publicReview(updated));
  }

  const upload = photo as File;
  const primary = await storePhoto(upload);
  const second = photos[1] ? await storePhoto(photos[1]) : null;
  const third = photos[2] ? await storePhoto(photos[2]) : null;

  try {
    const [created] = await db
      .insert(reviews)
      .values({
        customerName,
        location,
        projectType,
        rating,
        review,
        attributes,
        imageKey: primary.key,
        imageContentType: primary.contentType,
        imageKey2: second?.key ?? null,
        imageContentType2: second?.contentType ?? null,
        imageKey3: third?.key ?? null,
        imageContentType3: third?.contentType ?? null,
        imageAlt,
      })
      .returning();

    return json(publicReview(created), { status: 201 });
  } catch (error) {
    // The photos are already stored but the row never landed. Drop them so a
    // failed submission doesn't leave unreachable objects behind forever.
    await Promise.all(storedKeys.map((k) => store.delete(k).catch(() => undefined)));
    throw error;
  }
};

export default async (request: Request) => {
  try {
    return await handleReviewsRequest(request);
  } catch (error) {
    console.error("reviews function failed", error);
    return errorJson();
  }
};

export const config: Config = {
  path: ["/api/reviews", "/api/reviews/:id"],
};
