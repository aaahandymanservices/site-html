CREATE TABLE "home_care_subscriptions" (
	"id" serial PRIMARY KEY,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"city" text,
	"zip" text,
	"zone" text,
	"plan" text NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"quoted_price" integer,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "zip" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "zone" text;