import type { Config } from "@netlify/functions";

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });

const getEnv = (name: string): string => {
  try {
    if (typeof Netlify !== "undefined" && Netlify.env) {
      return Netlify.env.get(name) ?? "";
    }
  } catch {}
  try {
    const globalProcess = (globalThis as any).process;
    if (globalProcess && globalProcess.env) {
      return globalProcess.env[name] ?? "";
    }
  } catch {}
  return "";
};

// Constant-time string comparison to avoid leaking the secret via timing.
const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

// Pull the submitted passcode from the request: an X-Admin-Token header
// (preferred), an Authorization: Bearer header, or a JSON `passcode`/`token` field.
const submittedSecret = async (request: Request) => {
  const header = request.headers.get("x-admin-token") ?? request.headers.get("x-admin-secret") ?? "";
  if (header.trim()) return header.trim().slice(0, 200);

  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (bearer?.trim()) return bearer.trim().slice(0, 200);

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { passcode?: string; token?: string };
    const value = body.passcode ?? body.token ?? "";
    return String(value).trim().slice(0, 200);
  }

  return "";
};

// Verifies an admin passcode against ADMIN_API_TOKEN without ever returning the
// secret. The reviews function performs the same check before any mutation; this
// endpoint lets the client confirm access before revealing management controls.
const handleAuthRequest = async (request: Request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const adminSecret = getEnv("ADMIN_API_TOKEN");
  if (!adminSecret) {
    console.error("ADMIN_API_TOKEN is not configured; refusing admin verification.");
    return json({ error: "Admin access is not configured." }, { status: 503 });
  }

  const submitted = await submittedSecret(request);
  if (!submitted || !timingSafeEqual(submitted, adminSecret)) {
    return json({ error: "That access key was not recognized." }, { status: 401 });
  }

  return json({ ok: true });
};

export default async (request: Request) => {
  try {
    return await handleAuthRequest(request);
  } catch (error) {
    console.error("admin-auth function failed", error);
    return json({ error: "Something went wrong. Please try again soon." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/admin/verify",
  method: "POST",
};
