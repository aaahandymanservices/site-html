import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { customerJobs, jobNotifications } from "../../db/schema.js";
import {
  errorMessage,
  json,
  parseJobId,
  rejectCrossOriginMutation,
  requireAdmin,
} from "./lib/admin.js";

type DeliveryResult = {
  channel: "sms" | "email";
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);

const sendSms = async (phone: string, message: string): Promise<DeliveryResult> => {
  const accountSid = Netlify.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Netlify.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Netlify.env.get("TWILIO_FROM_NUMBER");
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio is not configured.");
  }

  const body = new URLSearchParams({ To: phone, From: fromNumber, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Twilio rejected the message.");
  return { channel: "sms", status: "sent", providerMessageId: result.sid };
};

const sendEmail = async (email: string, customerName: string, message: string): Promise<DeliveryResult> => {
  const apiKey = Netlify.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("Resend is not configured.");

  const from = Netlify.env.get("NOTIFICATION_FROM_EMAIL") || "AAA Handyman Services <contact@aaahandyman.services>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "AAA Handyman Services is on the way",
      text: message,
      html: `<div style="font-family:Arial,sans-serif;color:#1b2a4a;line-height:1.6"><p>Hi ${escapeHtml(customerName)},</p><p>${escapeHtml(message)}</p><p>Questions? Call <strong>(248) 385-3432</strong>.</p></div>`,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Resend rejected the email.");
  return { channel: "email", status: "sent", providerMessageId: result.id };
};

export default async (request: Request, context: Context) => {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
  }

  const id = parseJobId(context.params.id);
  if (!id) return json({ error: "Invalid job ID." }, { status: 400 });

  const [job] = await db.select().from(customerJobs).where(eq(customerJobs.id, id)).limit(1);
  if (!job) return json({ error: "Job not found." }, { status: 404 });
  if (job.status === "Completed") return json({ error: "Completed jobs cannot receive an on-the-way alert." }, { status: 409 });

  const smsConfigured = Boolean(
    Netlify.env.get("TWILIO_ACCOUNT_SID") && Netlify.env.get("TWILIO_AUTH_TOKEN") && Netlify.env.get("TWILIO_FROM_NUMBER"),
  );
  const emailConfigured = Boolean(Netlify.env.get("RESEND_API_KEY"));
  if (!smsConfigured && !emailConfigured) {
    return json({ error: "Notification delivery is not configured. Add Twilio or Resend environment variables." }, { status: 503 });
  }

  const message = `AAA Handyman Services is on the way to your location at ${job.jobAddress}!`;
  const deliveryTasks: Array<{ channel: DeliveryResult["channel"]; send: () => Promise<DeliveryResult> }> = [];
  if (smsConfigured) deliveryTasks.push({ channel: "sms", send: () => sendSms(job.phone, message) });
  if (emailConfigured) deliveryTasks.push({ channel: "email", send: () => sendEmail(job.email, job.customerName, message) });

  const deliveries = await Promise.all(
    deliveryTasks.map(async ({ channel, send }) => {
        try {
          return await send();
        } catch (error) {
          return { channel, status: "failed", error: errorMessage(error) } as DeliveryResult;
        }
      }),
  );

  await db.insert(jobNotifications).values(
    deliveries.map((delivery) => ({
      jobId: id,
      channel: delivery.channel,
      status: delivery.status,
      providerMessageId: delivery.providerMessageId,
      errorMessage: delivery.error,
    })),
  );

  const sent = deliveries.filter((delivery) => delivery.status === "sent");
  if (sent.length === 0) {
    return json({ error: "The alert could not be delivered.", deliveries }, { status: 502 });
  }

  const [updatedJob] = await db
    .update(customerJobs)
    .set({ status: "On The Way", updatedAt: new Date() })
    .where(eq(customerJobs.id, id))
    .returning();

  return json({ job: updatedJob, deliveries, message });
};

export const config: Config = {
  path: "/api/admin/jobs/:id/notify",
};
