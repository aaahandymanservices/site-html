import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { giftCertificateRedemptions } from "../../db/schema.js";

/**
 * One-time enforcement for the $50 first-service gift certificate.
 *
 * The site has no customer login, so the email address a visitor types into
 * the booking, contact, or quote form is the only durable identity we have.
 * `gift_certificate_redemptions.email` is UNIQUE, which makes the database the
 * single source of truth: the first claim inserts, every later claim for the
 * same address hits the conflict and is ignored. Browser storage in
 * public/js/gift-certificate.js is only a fast path for hiding the offer -- it
 * can be cleared, so it must never be the thing that decides eligibility.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type GiftCertificateSource = "booking_form" | "contact_form" | "quote_form" | "manual";

const SOURCES = new Set<GiftCertificateSource>([
  "booking_form",
  "contact_form",
  "quote_form",
  "manual",
]);

export const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();

export const isValidEmail = (email: string) => EMAIL_PATTERN.test(email);

export const normalizeSource = (value: unknown): GiftCertificateSource => {
  const source = String(value ?? "").trim() as GiftCertificateSource;
  return SOURCES.has(source) ? source : "manual";
};

/**
 * Reads a common set of truthy spellings so callers can pass a checkbox value
 * ("on", "true", the checkbox's own descriptive value) or a real boolean.
 */
export const isCertificateRequested = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return false;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return false;
  return raw !== "false" && raw !== "off" && raw !== "0" && raw !== "no";
};

export type RedemptionStatus = {
  firstServiceGiftRedeemed: boolean;
  redeemedAt: string | null;
};

export const getRedemptionStatus = async (email: string): Promise<RedemptionStatus> => {
  const [existing] = await db
    .select({ redeemedAt: giftCertificateRedemptions.redeemedAt })
    .from(giftCertificateRedemptions)
    .where(eq(giftCertificateRedemptions.email, email))
    .limit(1);

  return {
    firstServiceGiftRedeemed: Boolean(existing),
    redeemedAt: existing ? new Date(existing.redeemedAt).toISOString() : null,
  };
};

export type RedemptionResult = RedemptionStatus & {
  /** True when the certificate was already spent before this call. */
  alreadyRedeemed: boolean;
};

/**
 * Permanently marks the certificate as spent for this email. Idempotent: a
 * repeat claim reports `alreadyRedeemed` and leaves the original row (and its
 * timestamp and source) untouched, so the record always reflects the first use.
 */
export const recordRedemption = async (
  email: string,
  { customerName, source }: { customerName?: string | null; source?: unknown } = {},
): Promise<RedemptionResult> => {
  const [inserted] = await db
    .insert(giftCertificateRedemptions)
    .values({
      email,
      customerName: customerName?.trim() || null,
      source: normalizeSource(source),
    })
    .onConflictDoNothing({ target: giftCertificateRedemptions.email })
    .returning({ redeemedAt: giftCertificateRedemptions.redeemedAt });

  if (inserted) {
    return {
      firstServiceGiftRedeemed: true,
      redeemedAt: new Date(inserted.redeemedAt).toISOString(),
      alreadyRedeemed: false,
    };
  }

  const status = await getRedemptionStatus(email);
  return { ...status, alreadyRedeemed: true };
};

/**
 * Undoes a redemption this request created. Only for the case where the
 * certificate was claimed and the work it was claimed against then failed to
 * save -- without it, a customer whose booking errored out would have spent
 * their certificate on a booking that does not exist.
 */
export const releaseRedemption = async (email: string) => {
  await db.delete(giftCertificateRedemptions).where(eq(giftCertificateRedemptions.email, email));
};
