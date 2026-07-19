// Server-side reCAPTCHA v2 verification shared by the custom function endpoints
// (booking + reviews). It uses Google reCAPTCHA — the same provider Netlify's
// built-in Forms reCAPTCHA is based on — but with an independent key pair so it
// never interferes with the managed reCAPTCHA on the Netlify Forms (contact,
// careers).
//
// Configure two environment variables to activate it:
//   CAPTCHA_SITE_KEY    reCAPTCHA v2 site key   (public, sent to the browser)
//   CAPTCHA_SECRET_KEY  reCAPTCHA v2 secret key (server-only, never exposed)
//
// When the secret is not set, verification is skipped so the forms keep working
// until the site owner provisions keys.

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export const captchaConfigured = () => Boolean(process.env.CAPTCHA_SECRET_KEY);

export interface CaptchaResult {
  ok: boolean;
  /** true when the check was intentionally not enforced (keys unset / provider unreachable) */
  skipped: boolean;
  error?: string;
}

export const verifyCaptcha = async (token: string, remoteIp?: string): Promise<CaptchaResult> => {
  const secret = process.env.CAPTCHA_SECRET_KEY;

  if (!secret) {
    // Not provisioned yet — allow the submission through but keep it visible in logs.
    console.warn("[captcha] CAPTCHA_SECRET_KEY not set; skipping verification.");
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, skipped: false, error: "Please complete the captcha and try again." };
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.set("remoteip", remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await res.json()) as { success?: boolean };
    if (data.success) {
      return { ok: true, skipped: false };
    }

    return { ok: false, skipped: false, error: "Captcha verification failed. Please try again." };
  } catch (err) {
    // Fail open on a network/provider error so a Google outage never blocks a
    // legitimate customer from booking.
    console.error("[captcha] verification request failed:", err);
    return { ok: true, skipped: true, error: "verify-unreachable" };
  }
};
