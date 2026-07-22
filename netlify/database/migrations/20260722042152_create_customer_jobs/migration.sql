CREATE TABLE "customer_jobs" (
	"id" serial PRIMARY KEY,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"job_address" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'Scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_notifications" (
	"id" serial PRIMARY KEY,
	"job_id" integer NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_notifications" ADD CONSTRAINT "job_notifications_job_id_customer_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "customer_jobs"("id") ON DELETE CASCADE;