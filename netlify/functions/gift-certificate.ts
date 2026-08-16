import type { Config } from "@netlify/functions";
import {
  getRedemptionStatus,
  isCertificateRequested,
  isValidEmail,
  normalizeEmail,
  recordRedemption,
} from "../lib/gift-certificate.js";
import { WRONG_METHOD_MESSAGE } from "../lib/messages.js";

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });

const errorJson = (message = "Something went wrong on our end. Please try again in a moment, or call us at (248) 385-3432.", status = 500) =>
  json({ error: message }, { status });

/**
 * Status and redemption endpoint for the $50 first-service gift certificate.
 *
 *   GET  /api/gift-certificate?email=someone@example.com
 *        -> { firstServiceGiftRedeemed, redeemedAt }
 *   POST /api/gift-certificate  { email, name?, source? }
 *        -> { firstServiceGiftRedeemed: true, alreadyRedeemed, redeemedAt }
 *
 * The response carries only the flag and the timestamp -- never the stored
 * name -- so an address typed by someone else can't be used to read back
 * another customer's details.
 */
export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        allow: "GET, POST, OPTIONS",
      },
    });
  }

  try {
    if (request.method === "GET") {
      const email = normalizeEmail(new URL(request.url).searchParams.get("email"));
      if (!email) {
        return errorJson("Please enter your email address.", 400);
      }
      if (!isValidEmail(email)) {
        return errorJson("Please provide a valid email address.", 400);
      }

      return json(await getRedemptionStatus(email));
    }

    if (request.method !== "POST") {
      return errorJson(WRONG_METHOD_MESSAGE, 405);
    }

    let email = "";
    let name = "";
    let source: unknown = "manual";
    let requested: unknown = true;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      email = normalizeEmail(body.email);
      name = String(body.name || body.customerName || "").trim();
      source = body.source;
      // Absent means "yes" -- posting to this endpoint at all is the claim.
      requested = body.firstServiceGiftCertificate ?? body["first-service-gift-certificate"] ?? true;
    } else {
      const formData = await request.formData();
      email = normalizeEmail(formData.get("email"));
      name = String(formData.get("name") || formData.get("customerName") || "").trim();
      source = formData.get("source");
      requested = formData.get("firstServiceGiftCertificate") ?? formData.get("first-service-gift-certificate") ?? true;
    }

    if (!email) {
      return errorJson("Please enter your email address.", 400);
    }
    if (!isValidEmail(email)) {
      return errorJson("Please provide a valid email address.", 400);
    }

    // A submission that did not tick the box shouldn't burn the certificate.
    if (!isCertificateRequested(requested)) {
      return json(await getRedemptionStatus(email));
    }

    const result = await recordRedemption(email, { customerName: name, source });
    return json(result, { status: result.alreadyRedeemed ? 200 : 201 });
  } catch (err) {
    console.error("gift certificate lookup failed", err);
    return errorJson("We couldn't check the gift certificate just now. Please try again in a moment.", 500);
  }
};

export const config: Config = {
  path: "/api/gift-certificate",
};
