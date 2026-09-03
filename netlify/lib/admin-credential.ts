/**
 * Shared verification for the owner's admin passcode.
 *
 * Two functions gate privileged work behind this passcode: `admin-auth`
 * confirms it before the reviews page reveals its management controls, and
 * `reviews` requires it for every edit and delete. They each used to compare
 * the submitted value against the raw `ADMIN_API_TOKEN` string, which meant
 * the live credential sat in plaintext in the environment and was compared
 * with a hand-rolled loop that returned early on a length mismatch and so
 * leaked the secret's length one request at a time.
 *
 * The preferred setup is now `ADMIN_API_TOKEN_HASH`: a salted PBKDF2-SHA512
 * verifier that the server can check but that cannot be replayed as a
 * credential if the environment is ever read by someone who should not have it.
 * Generate one with `node scripts/hash-admin-token.mjs`.
 *
 * `ADMIN_API_TOKEN` still works so an existing deploy keeps running, but it is
 * treated as deprecated: the comparison is done over fixed-length digests so it
 * no longer leaks length, and each cold start logs a reminder to migrate.
 */

import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
/*
 * Re-exported below so this module's public surface is unchanged by the move.
 * The implementation lives in env.ts because the spam guard needs the same
 * runtime probing and has no business importing it from the admin credential
 * code.
 */
import { getEnv } from "./env.js";

export { getEnv };

const DIGEST = "sha512";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const VERIFIER_SCHEME = "pbkdf2-sha512";

/**
 * OWASP's 2023 floor for PBKDF2-HMAC-SHA512. These endpoints are used by one
 * person a handful of times a day, so the ~100ms this costs per verification is
 * unnoticeable there while making offline guessing of a leaked verifier
 * expensive.
 */
export const DEFAULT_ITERATIONS = 210_000;

/** Longest passcode we will process, so an oversized body cannot force work. */
export const MAX_PASSCODE_LENGTH = 200;

/**
 * Builds a `pbkdf2-sha512$iterations$salt$hash` verifier for a passcode. Used by
 * scripts/hash-admin-token.mjs; the functions themselves only ever verify.
 */
export const hashAdminPasscode = (passcode: string, iterations = DEFAULT_ITERATIONS): string => {
  const salt = randomBytes(SALT_LENGTH);
  const derived = pbkdf2Sync(passcode.normalize("NFKC"), salt, iterations, KEY_LENGTH, DIGEST);
  return [VERIFIER_SCHEME, iterations, salt.toString("base64"), derived.toString("base64")].join("$");
};

type ParsedVerifier = { iterations: number; salt: Buffer; hash: Buffer };

const parseVerifier = (verifier: string): ParsedVerifier | null => {
  const [scheme, iterationsPart, saltPart, hashPart] = verifier.trim().split("$");
  if (scheme !== VERIFIER_SCHEME || !iterationsPart || !saltPart || !hashPart) return null;

  const iterations = Number.parseInt(iterationsPart, 10);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 5_000_000) return null;

  try {
    const salt = Buffer.from(saltPart, "base64");
    const hash = Buffer.from(hashPart, "base64");
    if (!salt.length || !hash.length) return null;
    return { iterations, salt, hash };
  } catch {
    return null;
  }
};

/**
 * Compares two secrets in constant time. Both sides are reduced to a SHA-256
 * digest first so the buffers handed to `timingSafeEqual` are always the same
 * size — it throws on a length mismatch, and branching on the length before the
 * call is exactly the leak this avoids.
 */
const digestsMatch = (a: string, b: string): boolean =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export type AdminAuthResult =
  /** No credential is configured on the server; callers must fail closed. */
  | { status: "not-configured" }
  /** A credential is configured and the submitted passcode did not match it. */
  | { status: "rejected" }
  | { status: "ok" };

let warnedAboutPlaintext = false;

/**
 * Verifies a submitted passcode against the configured credential.
 *
 * Fails closed: with neither `ADMIN_API_TOKEN_HASH` nor `ADMIN_API_TOKEN` set,
 * and with a malformed hash, nobody is authorized.
 */
export const verifyAdminPasscode = (submitted: string): AdminAuthResult => {
  const candidate = String(submitted ?? "").trim();
  const verifier = getEnv("ADMIN_API_TOKEN_HASH").trim();

  if (verifier) {
    const parsed = parseVerifier(verifier);
    if (!parsed) {
      console.error(
        `ADMIN_API_TOKEN_HASH is set but is not a valid ${VERIFIER_SCHEME} verifier; refusing admin access. Regenerate it with scripts/hash-admin-token.mjs.`,
      );
      return { status: "not-configured" };
    }

    // Checked after the verifier is parsed so a misconfigured server reports
    // itself the same way whether or not a passcode was supplied.
    if (!candidate || candidate.length > MAX_PASSCODE_LENGTH) return { status: "rejected" };

    const derived = pbkdf2Sync(candidate.normalize("NFKC"), parsed.salt, parsed.iterations, parsed.hash.length, DIGEST);
    return timingSafeEqual(derived, parsed.hash) ? { status: "ok" } : { status: "rejected" };
  }

  const legacy = getEnv("ADMIN_API_TOKEN");
  if (!legacy) return { status: "not-configured" };

  if (!warnedAboutPlaintext) {
    warnedAboutPlaintext = true;
    console.warn(
      "ADMIN_API_TOKEN is set as a plaintext secret. Generate a hashed verifier with `node scripts/hash-admin-token.mjs`, store it as ADMIN_API_TOKEN_HASH, and remove ADMIN_API_TOKEN.",
    );
  }

  if (!candidate || candidate.length > MAX_PASSCODE_LENGTH) return { status: "rejected" };
  return digestsMatch(candidate, legacy) ? { status: "ok" } : { status: "rejected" };
};

/**
 * Reads the submitted passcode from the places the admin UI sends it: an
 * `X-Admin-Token` header (preferred), an `Authorization: Bearer` header, or a
 * caller-supplied fallback pulled from a JSON, form, or query field.
 */
export const submittedPasscode = (request: Request, fallback = ""): string => {
  const header = request.headers.get("x-admin-token") ?? request.headers.get("x-admin-secret") ?? "";
  if (header.trim()) return header.trim().slice(0, MAX_PASSCODE_LENGTH);

  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (bearer?.trim()) return bearer.trim().slice(0, MAX_PASSCODE_LENGTH);

  return String(fallback ?? "").trim().slice(0, MAX_PASSCODE_LENGTH);
};
