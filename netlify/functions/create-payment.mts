import type { Config } from "@netlify/functions";

const STRIPE_API = "https://api.stripe.com/v1";
const MINIMUM_AMOUNT_CENTS = 100;
const MAXIMUM_AMOUNT_CENTS = 1_000_000;

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });

const clean = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const publicPaymentUrl = (name: string) => {
  const value = clean(Netlify.env.get(name), 500);
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const stripeRequest = async (path: string, options: RequestInit = {}) => {
  const secretKey = Netlify.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) {
    return { response: null, error: "Online payments are not configured yet. Please call (248) 385-3432 to make a payment." };
  }

  const response = await fetch(`${STRIPE_API}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${secretKey}`,
      ...(options.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    [key: string]: unknown;
  };

  if (!response.ok) {
    console.error("Stripe payment request failed", response.status, payload.error?.message || "Unknown Stripe error");
    return { response: null, error: "Secure checkout could not be started. Please check your details or call us for help." };
  }

  return { response: payload, error: "" };
};

export default async (request: Request) => {
  if (request.method === "GET") {
    const requestUrl = new URL(request.url);
    if (requestUrl.searchParams.get("payment_options") === "1") {
      return json({
        zelleUrl: publicPaymentUrl("ZELLE_PAYMENT_URL"),
        venmoUrl: publicPaymentUrl("VENMO_PAYMENT_URL"),
      });
    }

    const sessionId = clean(requestUrl.searchParams.get("session_id"), 200);
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return json({ error: "A valid checkout session is required." }, 400);
    }

    const { response, error } = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (!response) return json({ error }, 502);

    return json({
      paymentStatus: response.payment_status,
      amountTotal: response.amount_total,
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const amount = Number(clean(body.amount, 20));
  const amountCents = Math.round(amount * 100);
  const customerName = clean(body.customerName, 100);
  const email = clean(body.email, 160).toLowerCase();
  const reference = clean(body.reference, 80);
  const paymentMethod = body.paymentMethod === "bank_transfer" ? "bank_transfer" : "checkout";

  if (!Number.isFinite(amount) || amountCents < MINIMUM_AMOUNT_CENTS || amountCents > MAXIMUM_AMOUNT_CENTS) {
    return json({ error: "Enter a payment amount between $1.00 and $10,000.00." }, 400);
  }
  if (customerName.length < 2) {
    return json({ error: "Enter the customer name shown on the invoice." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Enter a valid email address for the receipt." }, 400);
  }

  const siteOrigin = new URL(request.url).origin;
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${siteOrigin}/?payment=success&session_id={CHECKOUT_SESSION_ID}#payments`);
  params.set("cancel_url", `${siteOrigin}/?payment=canceled#payments`);
  params.set("customer_email", email);
  params.set("client_reference_id", reference || customerName);
  if (paymentMethod === "bank_transfer") {
    params.set("payment_method_types[0]", "customer_balance");
    params.set("payment_method_options[customer_balance][funding_type]", "bank_transfer");
    params.set("payment_method_options[customer_balance][bank_transfer][type]", "us_bank_transfer");
    params.set("customer_creation", "always");
  } else {
    params.set("automatic_payment_methods[enabled]", "true");
  }
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(amountCents));
  
  const productName = "AAA Handyman Services payment";
  const productDesc = reference ? `Invoice or job ${reference}` : `Payment from ${customerName}`;

  params.set("line_items[0][price_data][product_data][name]", productName);
  params.set("line_items[0][price_data][product_data][description]", productDesc);
  params.set("metadata[customer_name]", customerName);
  params.set("metadata[payment_reference]", reference || "Not provided");

  params.set("payment_intent_data[description]", productDesc);
  params.set("payment_intent_data[metadata][customer_name]", customerName);
  params.set("payment_intent_data[metadata][payment_reference]", reference || "Not provided");

  const { response, error } = await stripeRequest("/checkout/sessions", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!response || typeof response.url !== "string") return json({ error }, 502);

  return json({ url: response.url });
};

export const config: Config = {
  path: "/api/create-payment",
};
