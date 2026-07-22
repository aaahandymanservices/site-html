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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customerJobs = pgTable("customer_jobs", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  jobAddress: text("job_address").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").default("Scheduled").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobNotifications = pgTable("job_notifications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .notNull()
    .references(() => customerJobs.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});
