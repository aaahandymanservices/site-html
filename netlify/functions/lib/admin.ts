import { getUser } from "@netlify/identity";

export const JOB_STATUSES = ["Scheduled", "On The Way", "In Progress", "Completed"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });

export const requireAdmin = async () => {
  const user = await getUser();
  if (!user) return { response: json({ error: "Authentication required." }, { status: 401 }) };

  if (!user.roles?.includes("admin") && user.role !== "admin") {
    return { response: json({ error: "Administrator access required." }, { status: 403 }) };
  }

  return { user };
};

export const rejectCrossOriginMutation = (request: Request) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;

  const origin = request.headers.get("origin");
  if (!origin) return null;

  const requestUrl = new URL(request.url);
  if (new URL(origin).host !== requestUrl.host) {
    return json({ error: "Invalid request origin." }, { status: 403 });
  }

  return null;
};

export const parseJobId = (value: string | undefined) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const isJobStatus = (value: unknown): value is JobStatus =>
  typeof value === "string" && JOB_STATUSES.includes(value as JobStatus);

export const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message.slice(0, 500) : "Unknown provider error";
