import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { reviews } from "../../db/schema.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

const publicReview = (review: typeof reviews.$inferSelect) => ({
  id: review.id,
  customerName: review.customerName,
  location: review.location,
  projectType: review.projectType,
  rating: review.rating,
  review: review.review,
  imageUrl: `/api/reviews/photo/${review.imageKey}`,
  imageAlt: review.imageAlt,
  createdAt: review.createdAt,
});

const validateReviewFields = (customerName: string, location: string, projectType: string, review: string, rating: number) => {
  if (!customerName || !location || !projectType || !review || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return "Please complete every review field.";
  }

  return "";
};

const validatePhoto = (photo: FormDataEntryValue | null, required: boolean) => {
  if (!(photo instanceof File) || photo.size === 0) {
    return required ? "Please upload a project photo." : "";
  }

  if (photo.size > MAX_IMAGE_SIZE) {
    return "Photos must be 10 MB or smaller.";
  }

  if (!IMAGE_TYPES.has(photo.type)) {
    return "Upload a JPG, PNG, WebP, or GIF photo.";
  }

  return "";
};

const getEnv = (name: string): string => {
  try {
    if (typeof Netlify !== "undefined" && Netlify.env) {
      return Netlify.env.get(name) ?? "";
    }
  } catch {}
  try {
    const globalProcess = (globalThis as any).process;
    if (globalProcess && globalProcess.env) {
      return globalProcess.env[name] ?? "";
    }
  } catch {}
  return "";
};

// Constant-time string comparison to avoid leaking the secret via timing.
const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

// Pull the admin secret from the request: an X-Admin-Token header (preferred),
// an Authorization: Bearer header, or a JSON/query/form field carried through.
const submittedAdminSecret = (request: Request, fallback = "") => {
  const header = request.headers.get("x-admin-token") ?? request.headers.get("x-admin-secret") ?? "";
  if (header.trim()) return header.trim().slice(0, 200);
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (bearer?.trim()) return bearer.trim().slice(0, 200);
  return fallback.trim().slice(0, 200);
};

// Authorization gate for any review mutation. Fails closed: if no admin secret
// is configured on the server, no one is allowed to edit or delete reviews.
const authorizeAdmin = (submitted: string): Response | null => {
  const adminSecret = getEnv("ADMIN_API_TOKEN");
  if (!adminSecret) {
    console.error("ADMIN_API_TOKEN is not configured; refusing review mutation.");
    return errorJson("Review management is not available right now.", 503);
  }
  if (!submitted || !timingSafeEqual(submitted, adminSecret)) {
    return errorJson("Administrator authentication is required to modify or remove reviews.", 401);
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
      return errorJson("This review submission could not be removed.", 400);
    }

    const [existing] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!existing) {
      return errorJson("This review submission could not be removed.", 404);
    }

    await db.delete(reviews).where(eq(reviews.id, id));
    await getStore("customer-reviews").delete(existing.imageKey);

    return json({ ok: true });
  }

  if (request.method !== "POST" && request.method !== "PUT") {
    return errorJson("Method not allowed", 405);
  }

  const isUpdate = request.method === "PUT";
  const id = isUpdate ? idFromRequest(request) : null;
  const form = await request.formData();
  const customerName = clean(form.get("customerName"), 80);
  const location = clean(form.get("location"), 90);
  const projectType = clean(form.get("projectType"), 80);
  const review = clean(form.get("review"), 700);
  const rating = Number.parseInt(String(form.get("rating") ?? ""), 10);
  const photo = form.get("photo");
  const formAdminToken = isUpdate ? clean(form.get("editToken") ?? form.get("adminToken"), 200) : "";

  const fieldError = validateReviewFields(customerName, location, projectType, review, rating);
  if (fieldError) {
    return errorJson(fieldError, 400);
  }

  const photoError = validatePhoto(photo, !isUpdate);
  if (photoError) {
    return errorJson(photoError, 400);
  }

  if (isUpdate) {
    const authError = authorizeAdmin(submittedAdminSecret(request, formAdminToken));
    if (authError) {
      return authError;
    }

    if (!id) {
      return errorJson("This review submission could not be updated.", 400);
    }

    const [existing] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!existing) {
      return errorJson("This review submission could not be updated.", 404);
    }

    let imageKey = existing.imageKey;
    let imageContentType = existing.imageContentType;
    const imageAlt = `${projectType} project photo from ${customerName} in ${location}`;
    const store = getStore("customer-reviews");

    if (photo instanceof File && photo.size > 0) {
      const extension = photo.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      imageKey = `${Date.now()}-${crypto.randomUUID()}-${slug(projectType)}.${extension}`;
      imageContentType = photo.type;
      await store.set(imageKey, await photo.arrayBuffer());
      await store.delete(existing.imageKey);
    }

    const [updated] = await db
      .update(reviews)
      .set({ customerName, location, projectType, rating, review, imageKey, imageContentType, imageAlt })
      .where(eq(reviews.id, id))
      .returning();

    return json(publicReview(updated));
  }

  const upload = photo as File;
  const extension = upload.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const imageKey = `${Date.now()}-${crypto.randomUUID()}-${slug(projectType)}.${extension}`;
  const imageAlt = `${projectType} project photo from ${customerName} in ${location}`;

  await getStore("customer-reviews").set(imageKey, await upload.arrayBuffer());

  const [created] = await db
    .insert(reviews)
    .values({
      customerName,
      location,
      projectType,
      rating,
      review,
      imageKey,
      imageContentType: upload.type,
      imageAlt,
    })
    .returning();

  return json(publicReview(created), { status: 201 });
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
