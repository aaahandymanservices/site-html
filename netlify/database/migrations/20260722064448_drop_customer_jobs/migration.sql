ALTER TABLE "job_notifications" DROP CONSTRAINT "job_notifications_job_id_customer_jobs_id_fkey";--> statement-breakpoint
DROP TABLE "customer_jobs";--> statement-breakpoint
DROP TABLE "job_notifications";