CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"service" text NOT NULL,
	"booking_date" text NOT NULL,
	"booking_time" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
