CREATE TABLE "ai_estimates" (
	"id" serial PRIMARY KEY,
	"customer_name" text,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"zip" text,
	"detected_issue" text,
	"service_category" text,
	"estimate_text" text NOT NULL,
	"price_low" integer,
	"price_high" integer,
	"out_of_scope" boolean DEFAULT false NOT NULL,
	"photo_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
