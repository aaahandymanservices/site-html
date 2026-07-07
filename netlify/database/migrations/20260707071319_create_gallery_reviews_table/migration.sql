CREATE TABLE "gallery_reviews" (
	"id" serial PRIMARY KEY,
	"customer_name" text NOT NULL,
	"location" text NOT NULL,
	"project_type" text NOT NULL,
	"rating" integer NOT NULL,
	"review" text NOT NULL,
	"image_key" text NOT NULL,
	"image_content_type" text NOT NULL,
	"image_alt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
