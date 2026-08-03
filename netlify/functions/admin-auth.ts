import type { Config } from "@netlify/functions";
import { MAX_PASSCODE_LENGTH, submittedPasscode, verifyAdminPasscode } from "../lib/admin-credential.js";
import { OWNER_SIGN_IN_UNAVAILABLE_MESSAGE, WRONG_METHOD_MESSAGE } from "../lib/messages.js";

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });

// Pull the submitted passcode from the request: an X-Admin-Token header
// (preferred), an Authorization: Bearer header, or a JSON `passcode`/`token` field.
const submittedSecret = async (request: Request) => {
  let fallback = "";
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { passcode?: string; token?: string };
    fallback = String(body.passcode ?? body.token ?? "").slice(0, MAX_PASSCODE_LENGTH);
  }
  return submittedPasscode(request, fallback);
};

// Verifies an admin passcode against the configured credential without ever
// returning it. The reviews function performs the same check before any
// mutation; this endpoint lets the client confirm access before revealing the
// management controls. netlify/lib/admin-credential.ts owns how the passcode is
// stored and compared.
const handleAuthRequest = async (request: Request) => {
  if (request.method !== "POST") {
    return json({ error: WRONG_METHOD_MESSAGE }, { status: 405 });
  }

  const result = verifyAdminPasscode(await submittedSecret(request));

  if (result.status === "not-configured") {
    console.error("No admin credential is configured; refusing admin verification.");
    return json({ error: OWNER_SIGN_IN_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  if (result.status === "rejected") {
    // "Owner key" is what the control that collects it is called on the reviews
    // page; "access key" appeared nowhere the owner can see it.
    return json({ error: "We don't recognize that owner key. Check it and try again." }, { status: 401 });
  }

  return json({ ok: true });
};

export default async (request: Request) => {
  try {
    return await handleAuthRequest(request);
  } catch (error) {
    console.error("admin-auth function failed", error);
    return json({ error: "Something went wrong on our end. Please try again in a moment." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/admin/verify",
  method: "POST",
};
