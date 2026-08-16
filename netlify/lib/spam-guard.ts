/*
 * Spam protection for the forms that submit to our own functions.
 *
 * Every public form on the site carries `data-netlify="true"`,
 * `data-netlify-recaptcha="true"` and a `netlify-honeypot` field, and Netlify's
 * build bot renders a reCAPTCHA widget into each one. Netlify only checks any
 * of that on submissions that reach Netlify Forms, though -- the honeypot and
 * the reCAPTCHA token are evaluated by the Forms endpoint, not by the page.
 * Three forms never reach it:
 *
 *   /contact       -> /api/contact-quote        (XHR, no Forms post at all)
 *   /book          -> /api/booking              (Forms post is a second copy)
 *   /services      -> /api/home-care-subscription  (likewise)
 *
 * So the visitor solved a challenge, the browser sent the token along inside
 * the FormData, and the function dropped it on the floor and wrote the row.
 * A bot posting straight at the endpoint met nothing at all. This module is
 * what those three functions call so the controls the markup advertises are
 * actually enforced on the path that writes to the database.
 *
 * The other three forms (/ , /careers, /customer-care) post to Netlify Forms
 * and are already covered by it; they do not call this.
 */
import { getEnv } from "./env.js";
import { PHONE } from "./messages.js";

/**
 * Matches the `netlify-honeypot` attribute on the forms. Most of them use
 * `bot-field`; the home care plans form on /services names its field
 * `plan-bot-field`, so callers can say which one they expect.
 */
const DEFAULT_HONEYPOT_FIELD = "bot-field";

/** The field reCAPTCHA's widget adds to the form it renders into. */
const CAPTCHA_FIELD = "g-recaptcha-response";

const VERIFY_ENDPOINT = "https://www.google.com/recaptcha/api/siteverify";

/*
 * A token is ~500 characters. The cap is here so an oversized field cannot make
 * us open an outbound request to Google carrying a megabyte of someone's text.
 */
const MAX_TOKEN_LENGTH = 4096;

/*
 * Google is on the request path for a form submission once a secret is set, so
 * it gets a short leash: a customer who filled in the booking form should not
 * sit through a 30s function timeout because siteverify is having a bad day.
 * A timeout is treated as "could not verify" and lets the submission through --
 * see the fail-open note on verifyCaptcha.
 */
const VERIFY_TIMEOUT_MS = 5000;

export const SPAM_REJECTED_MESSAGE =
  `We couldn't verify that submission. Please reload the page and try again, or call us at ${PHONE} and we'll take the details over the phone.`;

let warnedAboutMissingSecret = false;

/**
 * The two fields this module cares about, lifted out of whichever body shape
 * the function received.
 */
export type SpamFields = { honeypot: unknown; token: unknown };

/** For the functions that read a multipart or urlencoded body. */
export const spamFieldsFromForm = (
  form: FormData,
  honeypotField: string = DEFAULT_HONEYPOT_FIELD,
): SpamFields => ({
  honeypot: form.get(honeypotField),
  token: form.get(CAPTCHA_FIELD),
});

/** For the functions that accept `application/json`. */
export const spamFieldsFromJson = (
  body: unknown,
  honeypotField: string = DEFAULT_HONEYPOT_FIELD,
): SpamFields => {
  const record = (body ?? {}) as Record<string, unknown>;
  return { honeypot: record[honeypotField], token: record[CAPTCHA_FIELD] };
};

/**
 * True when the hidden field a human never sees came back with something in it.
 *
 * Cheap, needs no configuration, and catches the bulk of naive form spam, so it
 * runs whether or not reCAPTCHA is configured.
 */
export const honeypotFilled = (honeypot: unknown): boolean =>
  typeof honeypot === "string" && honeypot.trim().length > 0;

export type CaptchaResult = "ok" | "rejected" | "not-configured";

/**
 * Checks the reCAPTCHA token against Google.
 *
 * Requires `SITE_RECAPTCHA_SECRET` -- the same variable Netlify Forms reads, so
 * setting it (with its `SITE_RECAPTCHA_KEY` pair) points the widget and this
 * check at one set of keys. Without it the site is on Netlify's own managed
 * keys, whose secret we do not hold and cannot verify against; that returns
 * "not-configured" and the caller proceeds on the honeypot alone, which is
 * where the site already stood.
 *
 * Fails open on a network error or timeout: a homeowner trying to book a repair
 * should not be turned away because an outbound request failed. Bot traffic is
 * the thing being filtered here, not access to the business.
 */
export const verifyCaptcha = async (token: unknown, remoteIp?: string): Promise<CaptchaResult> => {
  const secret = getEnv("SITE_RECAPTCHA_SECRET").trim();
  if (!secret) {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.warn(
        "SITE_RECAPTCHA_SECRET is not set, so reCAPTCHA tokens cannot be verified on the API submission path. " +
          "Set SITE_RECAPTCHA_KEY and SITE_RECAPTCHA_SECRET to your own reCAPTCHA v2 keys to enable it.",
      );
    }
    return "not-configured";
  }

  const candidate = typeof token === "string" ? token.trim() : "";
  if (!candidate || candidate.length > MAX_TOKEN_LENGTH) return "rejected";

  const body = new URLSearchParams({ secret, response: candidate });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("recaptcha siteverify returned", response.status);
      return "not-configured";
    }

    const result = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (result.success) return "ok";

    // Logged rather than returned: the codes name our own configuration
    // ("invalid-input-secret") as often as they name the submission.
    console.warn("recaptcha rejected a submission", result["error-codes"] ?? []);
    return "rejected";
  } catch (err) {
    console.error("recaptcha siteverify failed", err);
    return "not-configured";
  }
};

/**
 * The whole check, as the three functions use it: honeypot first because it
 * costs nothing, then the token if a secret is configured.
 *
 * Returns true when the submission should be turned away. The caller answers
 * with SPAM_REJECTED_MESSAGE rather than anything that names which control
 * tripped.
 *
 * One caveat for anyone extending this: a reCAPTCHA token is single-use, and
 * verifying it here consumes it. Booking and the home care plans also mirror
 * their submission into Netlify Forms so it reaches the owner's inbox; those
 * mirror posts deliberately do not carry the token, because Netlify would try
 * to verify the same one and fail. Send the token to exactly one verifier.
 */
export const isSpamSubmission = async (fields: SpamFields, request: Request): Promise<boolean> => {
  if (honeypotFilled(fields.honeypot)) {
    console.warn("honeypot field was filled; rejecting submission");
    return true;
  }

  const remoteIp =
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined;

  return (await verifyCaptcha(fields.token, remoteIp)) === "rejected";
};
