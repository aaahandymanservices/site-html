import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { reviews } from "../../db/schema.js";
import { verifyCaptcha } from "../../lib/captcha.js";

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

const tokenMatches = (existingToken: string | null, submittedToken: string) =>
  Boolean(existingToken && submittedToken && submittedToken === existingToken);

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
    const submittedToken = clean(
      request.headers.get("content-type")?.includes("application/json")
        ? ((await request.json().catch(() => ({}))) as { editToken?: string }).editToken ?? null
        : null,
      80
    );

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

    if (!tokenMatches(existing.editToken, submittedToken)) {
      return errorJson("This review submission can only be removed from the browser that created it.", 403);
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
  const editToken = isUpdate ? clean(form.get("editToken"), 80) : crypto.randomUUID();

  const fieldError = validateReviewFields(customerName, location, projectType, review, rating);
  if (fieldError) {
    return errorJson(fieldError, 400);
  }

  const photoError = validatePhoto(photo, !isUpdate);
  if (photoError) {
    return errorJson(photoError, 400);
  }

  // Spam protection for new public submissions (edits are already gated by the
  // per-review edit token, so they don't need a fresh captcha).
  if (!isUpdate) {
    const captcha = verifyCaptcha(
      clean(form.get("captchaToken"), 200),
      clean(form.get("captchaAnswer"), 20)
    );
    if (!captcha.ok) {
      return errorJson(captcha.error || "Captcha verification failed. Please try again.", 400);
    }
  }

  if (isUpdate) {
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

    if (!tokenMatches(existing.editToken, editToken)) {
      return errorJson("This review submission can only be edited from the browser that created it.", 403);
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
      editToken,
    })
    .returning();

  return json(
    {
      ...publicReview(created),
      editToken,
    },
    { status: 201 }
  );
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
