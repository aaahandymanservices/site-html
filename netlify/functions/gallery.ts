import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { galleryReviews } from "../../db/schema.js";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });

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
  const id = Number.parseInt(new URL(request.url).pathname.replace("/api/gallery/", ""), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const publicReview = (review: typeof galleryReviews.$inferSelect) => ({
  id: review.id,
  customerName: review.customerName,
  location: review.location,
  projectType: review.projectType,
  rating: review.rating,
  review: review.review,
  imageUrl: `/api/gallery/photo/${review.imageKey}`,
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
    return "Photos must be 4 MB or smaller.";
  }

  if (!IMAGE_TYPES.has(photo.type)) {
    return "Upload a JPG, PNG, WebP, or GIF photo.";
  }

  return "";
};

export default async (request: Request) => {
  if (request.method === "GET") {
    const reviews = await db
      .select()
      .from(galleryReviews)
      .orderBy(desc(galleryReviews.createdAt))
      .limit(24);

    return json(reviews.map(publicReview));
  }

  if (request.method === "DELETE") {
    const id = idFromRequest(request);
    const { editToken } = await request.json().catch(() => ({ editToken: "" }));

    if (!id || !editToken) {
      return json({ error: "This gallery submission could not be removed." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(galleryReviews)
      .where(and(eq(galleryReviews.id, id), eq(galleryReviews.editToken, String(editToken))))
      .limit(1);

    if (!existing) {
      return json({ error: "This gallery submission could not be removed." }, { status: 403 });
    }

    await db.delete(galleryReviews).where(eq(galleryReviews.id, id));
    await getStore("customer-gallery").delete(existing.imageKey);

    return json({ ok: true });
  }

  if (request.method !== "POST" && request.method !== "PUT") {
    return json({ error: "Method not allowed" }, { status: 405 });
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
    return json({ error: fieldError }, { status: 400 });
  }

  const photoError = validatePhoto(photo, !isUpdate);
  if (photoError) {
    return json({ error: photoError }, { status: 400 });
  }

  if (isUpdate) {
    if (!id || !editToken) {
      return json({ error: "This gallery submission could not be updated." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(galleryReviews)
      .where(and(eq(galleryReviews.id, id), eq(galleryReviews.editToken, editToken)))
      .limit(1);

    if (!existing) {
      return json({ error: "This gallery submission could not be updated." }, { status: 403 });
    }

    let imageKey = existing.imageKey;
    let imageContentType = existing.imageContentType;
    const imageAlt = `${projectType} project photo from ${customerName} in ${location}`;
    const store = getStore("customer-gallery");

    if (photo instanceof File && photo.size > 0) {
      const extension = photo.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      imageKey = `${Date.now()}-${crypto.randomUUID()}-${slug(projectType)}.${extension}`;
      imageContentType = photo.type;
      await store.set(imageKey, await photo.arrayBuffer());
      await store.delete(existing.imageKey);
    }

    const [updated] = await db
      .update(galleryReviews)
      .set({ customerName, location, projectType, rating, review, imageKey, imageContentType, imageAlt })
      .where(eq(galleryReviews.id, id))
      .returning();

    return json(publicReview(updated));
  }

  const upload = photo as File;
  const extension = upload.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const imageKey = `${Date.now()}-${crypto.randomUUID()}-${slug(projectType)}.${extension}`;
  const imageAlt = `${projectType} project photo from ${customerName} in ${location}`;

  await getStore("customer-gallery").set(imageKey, await upload.arrayBuffer());

  const [created] = await db
    .insert(galleryReviews)
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

export const config: Config = {
  path: ["/api/gallery", "/api/gallery/:id"],
};
