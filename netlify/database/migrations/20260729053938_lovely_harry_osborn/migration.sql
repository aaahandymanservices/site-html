CREATE TABLE "gift_certificate_redemptions" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"customer_name" text,
	"source" text DEFAULT 'booking_form' NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "gift_certificate_applied" boolean DEFAULT false NOT NULL;