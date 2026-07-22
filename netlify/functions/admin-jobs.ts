import type { Config } from "@netlify/functions";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { customerJobs } from "../../db/schema.js";
import { cleanText, isJobStatus, json, rejectCrossOriginMutation, requireAdmin } from "./lib/admin.js";

export default async (request: Request) => {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  if (request.method === "GET") {
    const jobs = await db.select().from(customerJobs).orderBy(desc(customerJobs.scheduledAt));
    return json({ jobs });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const customerName = cleanText(body.customerName, 120);
    const phone = cleanText(body.phone, 40);
    const email = cleanText(body.email, 180).toLowerCase();
    const jobAddress = cleanText(body.jobAddress, 240);
    const notes = cleanText(body.notes, 2000) || null;
    const scheduledAt = new Date(body.scheduledAt);
    const status = isJobStatus(body.status) ? body.status : "Scheduled";

    if (!customerName || !phone || !email || !jobAddress || Number.isNaN(scheduledAt.getTime())) {
      return json({ error: "Name, phone, email, address, and a valid scheduled time are required." }, { status: 400 });
    }

    const [job] = await db
      .insert(customerJobs)
      .values({ customerName, phone, email, jobAddress, scheduledAt, status, notes })
      .returning();

    return json({ job }, { status: 201 });
  }

  return json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "GET, POST" } });
};

export const config: Config = {
  path: "/api/admin/jobs",
};
