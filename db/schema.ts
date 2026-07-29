import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const reviews = pgTable("gallery_reviews", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  location: text("location").notNull(),
  projectType: text("project_type").notNull(),
  rating: integer("rating").notNull(),
  review: text("review").notNull(),
  imageKey: text("image_key").notNull(),
  imageContentType: text("image_content_type").notNull(),
  imageAlt: text("image_alt").notNull(),
  editToken: text("edit_token"),
  // Comma-separated highlight tags chosen by the customer (e.g. "Punctual,Fair Pricing").
  attributes: text("attributes"),
  // Optional public reply from the business owner, shown beneath the review.
  ownerResponse: text("owner_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const seasonalSubscribers = pgTable("seasonal_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  source: text("source").default("quote_form").notNull(), // 'quote_form' or 'direct'
  optIn: boolean("opt_in").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  service: text("service").notNull(),
  bookingDate: text("booking_date").notNull(),
  bookingTime: text("booking_time").notNull(),
  message: text("message"),
  photoKey: text("photo_key"),
  status: text("status").default("pending").notNull(),
  // True when this booking is the one that consumed the customer's $50
  // first-service gift certificate, so the owner can see the discount owed
  // without cross-referencing the redemption table.
  giftCertificateApplied: boolean("gift_certificate_applied").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per customer who has consumed their $50 first-service gift
// certificate. The email is the identity here -- the site has no customer
// login -- and the UNIQUE constraint is what makes the offer one-time: a
// second claim for the same address conflicts instead of inserting.
export const giftCertificateRedemptions = pgTable("gift_certificate_redemptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  customerName: text("customer_name"),
  // Where it was claimed: 'booking_form', 'contact_form', 'quote_form', or 'manual'.
  source: text("source").default("booking_form").notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).defaultNow().notNull(),
});
