import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const galleryReviews = pgTable("gallery_reviews", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  location: text("location").notNull(),
  projectType: text("project_type").notNull(),
  rating: integer("rating").notNull(),
  review: text("review").notNull(),
  imageKey: text("image_key").notNull(),
  imageContentType: text("image_content_type").notNull(),
  imageAlt: text("image_alt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
