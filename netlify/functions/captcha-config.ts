import type { Config } from "@netlify/functions";

// Exposes the public reCAPTCHA site key to the browser at runtime so the static
// HTML forms don't need it hard-coded. Only the *public* site key is returned —
// never the secret. When no key is configured the widget stays disabled and the
// forms submit without a captcha challenge.
export default async () => {
  const siteKey = process.env.CAPTCHA_SITE_KEY || "";

  return Response.json(
    { enabled: Boolean(siteKey), siteKey },
    { headers: { "cache-control": "public, max-age=300" } }
  );
};

export const config: Config = {
  path: "/api/captcha-config",
};
