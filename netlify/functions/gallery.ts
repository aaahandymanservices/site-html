import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { desc } from "drizzle-orm";
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

export default async (request: Request) => {
  if (request.method === "GET") {
    const reviews = await db
      .select()
      .from(galleryReviews)
      .orderBy(desc(galleryReviews.createdAt))
      .limit(24);

    return json(
      reviews.map((review) => ({
        id: review.id,
        customerName: review.customerName,
        location: review.location,
        projectType: review.projectType,
        rating: review.rating,
        review: review.review,
        imageUrl: `/api/gallery/photo/${review.imageKey}`,
        imageAlt: review.imageAlt,
        createdAt: review.createdAt,
      }))
    );
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const form = await request.formData();
  const customerName = clean(form.get("customerName"), 80);
  const location = clean(form.get("location"), 90);
  const projectType = clean(form.get("projectType"), 80);
  const review = clean(form.get("review"), 700);
  const rating = Number.parseInt(String(form.get("rating") ?? ""), 10);
  const photo = form.get("photo");

  if (!customerName || !location || !projectType || !review || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: "Please complete every review field." }, { status: 400 });
  }

  if (!(photo instanceof File) || photo.size === 0) {
    return json({ error: "Please upload a project photo." }, { status: 400 });
  }

  if (photo.size > MAX_IMAGE_SIZE) {
    return json({ error: "Photos must be 4 MB or smaller." }, { status: 400 });
  }

  if (!IMAGE_TYPES.has(photo.type)) {
    return json({ error: "Upload a JPG, PNG, WebP, or GIF photo." }, { status: 400 });
  }

  const extension = photo.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const imageKey = `${Date.now()}-${crypto.randomUUID()}-${slug(projectType)}.${extension}`;
  const imageAlt = `${projectType} project photo from ${customerName} in ${location}`;

  const store = getStore("customer-gallery");
  await store.set(imageKey, await photo.arrayBuffer());

  const [created] = await db
    .insert(galleryReviews)
    .values({
      customerName,
      location,
      projectType,
      rating,
      review,
      imageKey,
      imageContentType: photo.type,
      imageAlt,
    })
    .returning();

  return json(
    {
      id: created.id,
      customerName: created.customerName,
      location: created.location,
      projectType: created.projectType,
      rating: created.rating,
      review: created.review,
      imageUrl: `/api/gallery/photo/${created.imageKey}`,
      imageAlt: created.imageAlt,
      createdAt: created.createdAt,
    },
    { status: 201 }
  );
};

export const config: Config = {
  path: "/api/gallery",
};
