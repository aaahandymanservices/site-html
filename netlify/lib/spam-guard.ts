/*
 * Spam protection for the forms that submit to our own functions.
 *
 * Every public form on the site carries `data-netlify="true"` and a
 * `netlify-honeypot` field. The ones that post straight to Netlify Forms --
 * / , /careers and /customer-care -- are covered by the honeypot and Netlify's
 * built-in spam filtering, which screens every submission the Forms endpoint
 * receives.
 *
 * Four forms never reach Netlify's checks first, though. They submit through
 * JavaScript to our functions and then mirror a copy into Netlify Forms, so
 * the honeypot has to be evaluated here, on the path that writes to the
 * database:
 *
 *   /contact       -> /api/contact-quote        (XHR, mirror mirrors a copy)
 *   /emergency     -> /api/contact-quote        (likewise)
 *   /book          -> /api/booking              (page form + booking modal)
 *   /services      -> /api/home-care-subscription
 *
 * The mirrored copies still pass through Netlify's spam filter on their way
 * into Forms, so the owner's inbox gets the same screening as the direct forms.
 */
import { PHONE } from "./messages.js";

/**
 * Matches the `netlify-honeypot` attribute on the forms. Most of them use
 * `bot-field`; the home care plans form on /services names its field
 * `plan-bot-field`, so callers can say which one they expect.
 */
const DEFAULT_HONEYPOT_FIELD = "bot-field";

export const SPAM_REJECTED_MESSAGE =
  `We couldn't verify that submission. Please reload the page and try again, or call us at ${PHONE} and we'll take the details over the phone.`;

/**
 * The field this module cares about, lifted out of whichever body shape the
 * function received.
 */
export type SpamFields = { honeypot: unknown };

/** For the functions that read a multipart or urlencoded body. */
export const spamFieldsFromForm = (
  form: FormData,
  honeypotField: string = DEFAULT_HONEYPOT_FIELD,
): SpamFields => ({
  honeypot: form.get(honeypotField),
});

/** For the functions that accept `application/json`. */
export const spamFieldsFromJson = (
  body: unknown,
  honeypotField: string = DEFAULT_HONEYPOT_FIELD,
): SpamFields => {
  const record = (body ?? {}) as Record<string, unknown>;
  return { honeypot: record[honeypotField] };
};

/**
 * True when the hidden field a human never sees came back with something in it.
 * Cheap, needs no configuration, and catches the bulk of naive form spam.
 */
export const honeypotFilled = (honeypot: unknown): boolean =>
  typeof honeypot === "string" && honeypot.trim().length > 0;

/**
 * The whole check, as the three functions use it. Returns true when the
 * submission should be turned away. The caller answers with
 * SPAM_REJECTED_MESSAGE rather than anything that names which control tripped.
 */
export const isSpamSubmission = (fields: SpamFields): boolean => {
  if (honeypotFilled(fields.honeypot)) {
    console.warn("honeypot field was filled; rejecting submission");
    return true;
  }
  return false;
};
