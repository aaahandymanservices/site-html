CREATE TABLE "home_maintenance_memberships" (
	"id" serial PRIMARY KEY,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"purchase_date" timestamp with time zone DEFAULT now() NOT NULL,
	"next_maintenance_date" timestamp with time zone NOT NULL,
	"notice_sent_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
