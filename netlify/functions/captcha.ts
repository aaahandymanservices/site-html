import type { Config } from "@netlify/functions";
import { generateChallenge, verifyCaptcha } from "../../lib/captcha.js";

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });

// Simple captcha endpoint (no keys required).
//   GET  /api/captcha  -> { question, token }  issue a fresh arithmetic challenge
//   POST /api/captcha  -> { ok }               verify a { token, answer } pair
//
// The custom-function forms (booking, reviews) submit the token + answer with
// their payload and are verified server-side there. The Netlify Forms pages
// (contact, careers) call POST here as a pre-submit gate before their native
// form post.
export default async (request: Request) => {
  if (request.method === "GET") {
    return json(generateChallenge());
  }

  if (request.method === "POST") {
    let token = "";
    let answer = "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      token = String(body.token ?? body.captchaToken ?? "");
      answer = String(body.answer ?? body.captchaAnswer ?? "");
    } else {
      const form = await request.formData();
      token = String(form.get("token") ?? form.get("captchaToken") ?? "");
      answer = String(form.get("answer") ?? form.get("captchaAnswer") ?? "");
    }

    const result = verifyCaptcha(token, answer);
    return json(result, { status: result.ok ? 200 : 400 });
  }

  return json({ error: "Method not allowed" }, { status: 405 });
};

export const config: Config = {
  path: "/api/captcha",
};
