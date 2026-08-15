CREATE TABLE "contact_requests" (
	"id" serial PRIMARY KEY,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"city" text,
	"service" text NOT NULL,
	"message" text NOT NULL,
	"photo_key_1" text,
	"photo_key_2" text,
	"photo_key_3" text,
	"photo_key_4" text,
	"photo_key_5" text,
	"seasonal_opt_in" boolean DEFAULT false NOT NULL,
	"gift_certificate_requested" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gift_certificate_redemptions" ALTER COLUMN "redeemed_at" SET DATA TYPE timestamp USING "redeemed_at"::timestamp;