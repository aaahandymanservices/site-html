import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// AI Estimate submissions: one row per photo-driven repair estimate the
// customer generates through the AI Construction Estimator. The model's
// structured read of the damage is stored alongside the raw estimate text
// so the dispatch team can confirm pricing before calling back. The original
// photo is kept in Netlify Blobs and referenced by `photoKey`.
export const aiEstimates = pgTable("ai_estimates", {
  id: serial("id").primaryKey(),
  // Optional contact info the customer may enter after reviewing the estimate.
  customerName: text("customer_name"),
  email: text("email"),
  phone: text("phone"),
  // Where the work happens, so dispatch knows where to route the follow-up.
  address: text("address"),
  city: text("city"),
  zip: text("zip"),
  // Short headline the model produces, e.g. "~6\" x 6\" drywall puncture".
  detectedIssue: text("detected_issue"),
  // Broad bucket: "Drywall Repair", "Minor Plumbing", etc.
  serviceCategory: text("service_category"),
  // Model's narrative estimate rendered in the site's output format.
  estimateText: text("estimate_text").notNull(),
  // Low/high of the preliminary range the model quoted, in whole dollars.
  priceLow: integer("price_low"),
  priceHigh: integer("price_high"),
  // True when the model flagged the job as out of minor scope.
  outOfScope: boolean("out_of_scope").default(false).notNull(),
  // Blob key for the uploaded photo (served by /api/ai-estimate/photo/:key).
  photoKey: text("photo_key"),
  // 'pending' until the customer clicks Submit, then 'submitted'; 'claimed'
  // once dispatch converts it into a booking.
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
  // Where the work happens. Nullable because every booking taken before the
  // widget asked for an address predates these columns, and the phone-in
  // bookings the owner enters by hand still only carry a name and a number.
  // `zip` is what decides `zone` (and therefore the travel differential), so
  // the two are stored together rather than re-derived at read time.
  address: text("address"),
  city: text("city"),
  zip: text("zip"),
  zone: text("zone"),
  status: text("status").default("pending").notNull(),
  // True when this booking is the one that consumed the customer's $50
  // first-service gift certificate, so the owner can see the discount owed
  // without cross-referencing the redemption table.
  giftCertificateApplied: boolean("gift_certificate_applied").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Quarterly Home Care Plan signups: the recurring counterpart to the one-off
// bookings above. Nothing is charged here -- the row is a request the owner
// calls back to confirm and set up billing for -- so there is no payment state
// to model, only which plan was chosen and how the customer wants to be billed.
export const homeCareSubscriptions = pgTable("home_care_subscriptions", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  city: text("city"),
  zip: text("zip"),
  zone: text("zone"),
  // Plan slug: 'essential', 'complete', or 'complete-plus'.
  plan: text("plan").notNull(),
  // 'monthly' or 'annual'. Annual is billed once and skips two months.
  billingCycle: text("billing_cycle").default("monthly").notNull(),
  // Price in whole dollars for the chosen plan and cycle, captured at signup so
  // a later price change cannot rewrite what someone was quoted.
  quotedPrice: integer("quoted_price"),
  notes: text("notes"),
  status: text("status").default("pending").notNull(),
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
