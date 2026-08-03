/*
 * Copy that more than one function needs to say the same way.
 *
 * The per-function `errorJson` defaults were already written for a homeowner --
 * plain language, and a phone number to fall back on. What sat underneath them
 * were the branches that answer with protocol vocabulary instead, and those are
 * the ones a visitor meets when something has already gone wrong. Keeping the
 * shared ones here means the wording is fixed in one place rather than drifting
 * apart across six copies.
 */

/*
 * The 405 branch of every function. Unlikely to surface, but book-page.js reads
 * `data.error` straight into the visible error banner, so a mis-routed request
 * would otherwise show a homeowner the words "Method not allowed".
 */
export const WRONG_METHOD_MESSAGE =
  "We couldn't send that request. Please refresh the page and try again.";

/*
 * Owner-only tooling with no credential configured. Not a temporary outage, so
 * it deliberately avoids "right now" -- nothing changes if the owner waits.
 */
export const OWNER_SIGN_IN_UNAVAILABLE_MESSAGE =
  "Owner sign-in isn't set up on this site yet.";

export const PHONE = "(248) 385-3432";
