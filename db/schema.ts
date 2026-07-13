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

export const homeMaintenanceMemberships = pgTable("home_maintenance_memberships", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  purchaseDate: timestamp("purchase_date", { withTimezone: true }).defaultNow().notNull(),
  nextMaintenanceDate: timestamp("next_maintenance_date", { withTimezone: true }).notNull(),
  noticeSentAt: timestamp("notice_sent_at", { withTimezone: true }),
  status: text("status").default("active").notNull(), // 'active', 'cancelled'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


