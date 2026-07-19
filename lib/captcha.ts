// Self-contained "simple captcha" shared by the custom function endpoints
// (booking + reviews) and the Netlify Forms pages (contact, careers).
//
// Instead of Google reCAPTCHA — which requires provisioning a public/secret key
// pair — this is a lightweight arithmetic challenge that verifies entirely with
// code in this repo. There is NOTHING to configure: no environment variables, no
// third-party account. It is a low-friction bot deterrent, not a cryptographic
// guarantee.
//
// How it works:
//   1. generateChallenge() builds a small addition question and a signed token.
//      The token embeds an expiry timestamp and an HMAC of "expiry:answer" keyed
//      by an in-code salt. The plaintext answer is never placed in the token.
//   2. verifyCaptcha(token, answer) re-derives the HMAC from the submitted answer
//      and compares it to the one carried in the token, and checks the expiry.
//      A correct answer on a fresh token is the only way to produce a match.

import { createHmac, timingSafeEqual } from "node:crypto";

// Fixed in-code salt. This is intentionally not an environment secret: the point
// of the simple captcha is that it works with zero configuration. Bump the suffix
// to invalidate every outstanding challenge at once.
const SALT = "aaa-handyman-simple-captcha-v1";

// Challenges are single-page and short-lived; 20 minutes covers a slow form fill.
const TTL_MS = 20 * 60 * 1000;

const sign = (exp: number, answer: string) =>
  createHmac("sha256", SALT).update(`${exp}:${answer}`).digest("hex");

export interface Challenge {
  /** Human-readable question to show the visitor, e.g. "What is 4 + 7?" */
  question: string;
  /** Opaque signed token echoed back on submit alongside the visitor's answer. */
  token: string;
}

export const generateChallenge = (): Challenge => {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const answer = a + b;
  const exp = Date.now() + TTL_MS;
  const token = `${exp}.${sign(exp, String(answer))}`;
  return { question: `What is ${a} + ${b}?`, token };
};

export interface CaptchaResult {
  ok: boolean;
  error?: string;
}

export const verifyCaptcha = (token: string, answer: string): CaptchaResult => {
  const cleanAnswer = String(answer ?? "").trim();
  if (!token || !cleanAnswer) {
    return { ok: false, error: "Please answer the spam-check question and try again." };
  }

  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!expStr || !sig || !Number.isFinite(exp)) {
    return { ok: false, error: "Spam check expired. Please refresh the question and try again." };
  }

  if (Date.now() > exp) {
    return { ok: false, error: "Spam check expired. Please refresh the question and try again." };
  }

  const expected = sign(exp, cleanAnswer);
  const provided = Buffer.from(sig);
  const derived = Buffer.from(expected);
  if (provided.length !== derived.length || !timingSafeEqual(provided, derived)) {
    return { ok: false, error: "That answer wasn't correct. Please try the spam-check question again." };
  }

  return { ok: true };
};
