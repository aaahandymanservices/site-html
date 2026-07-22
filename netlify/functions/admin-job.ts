import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { customerJobs } from "../../db/schema.js";
import {
  cleanText,
  isJobStatus,
  json,
  parseJobId,
  rejectCrossOriginMutation,
  requireAdmin,
} from "./lib/admin.js";

export default async (request: Request, context: Context) => {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  if (request.method !== "PATCH") {
    return json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "PATCH" } });
  }

  const id = parseJobId(context.params.id);
  if (!id) return json({ error: "Invalid job ID." }, { status: 400 });

  const body = await request.json();
  const updates: Partial<typeof customerJobs.$inferInsert> = { updatedAt: new Date() };

  if ("customerName" in body) updates.customerName = cleanText(body.customerName, 120);
  if ("phone" in body) updates.phone = cleanText(body.phone, 40);
  if ("email" in body) updates.email = cleanText(body.email, 180).toLowerCase();
  if ("jobAddress" in body) updates.jobAddress = cleanText(body.jobAddress, 240);
  if ("notes" in body) updates.notes = cleanText(body.notes, 2000) || null;
  if ("status" in body) {
    if (!isJobStatus(body.status)) return json({ error: "Invalid job status." }, { status: 400 });
    updates.status = body.status;
  }
  if ("scheduledAt" in body) {
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return json({ error: "Invalid scheduled time." }, { status: 400 });
    updates.scheduledAt = scheduledAt;
  }

  if ([updates.customerName, updates.phone, updates.email, updates.jobAddress].some((value) => value === "")) {
    return json({ error: "Customer and job details cannot be blank." }, { status: 400 });
  }

  const [job] = await db.update(customerJobs).set(updates).where(eq(customerJobs.id, id)).returning();
  if (!job) return json({ error: "Job not found." }, { status: 404 });

  return json({ job });
};

export const config: Config = {
  path: "/api/admin/jobs/:id",
};
