import { createHmac } from "node:crypto";
import { z } from "zod";

/**
 * WayForPay «Purchase» (hosted payment page) — the money path for the ₴999
 * offer (spec 2026-08-05 §2).
 *
 * Pure and env-lazy on purpose: no "server-only", no module-level env reads, so
 * it imports cleanly in unit tests and can never crash a build that has no
 * WayForPay keys.
 *
 * Field orders below are transcribed from the official docs, fetched 2026-08-05:
 *   Purchase request, serviceUrl callback, callback response
 *     → https://wiki.wayforpay.com/en/view/852102
 *   Transaction statuses / reason codes
 *     → https://wiki.wayforpay.com/en/view/852131
 * Do not reorder any SIGNATURE_* list without re-reading those pages: the order
 * IS the protocol, and a wrong order fails only at runtime, against real money.
 */

/** Hosted payment page — the form POSTs here. */
export const WAYFORPAY_PAY_URL = "https://secure.wayforpay.com/pay";

/**
 * Purchase request signature (docs 852102): HMAC_MD5 over
 *   merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;
 *   productName[0..n];productCount[0..n];productPrice[0..n]
 * joined with ";" in UTF-8. Note the grouping: ALL names, then ALL counts, then
 * ALL prices — not per-product tuples.
 */

/**
 * serviceUrl callback signature (docs 852102): HMAC_MD5 over
 *   merchantAccount;orderReference;amount;currency;authCode;cardPan;
 *   transactionStatus;reasonCode
 */
const SIGNATURE_CALLBACK_FIELDS = [
  "merchantAccount",
  "orderReference",
  "amount",
  "currency",
  "authCode",
  "cardPan",
  "transactionStatus",
  "reasonCode",
] as const;

/**
 * Response we must return to the callback (docs 852102): HMAC_MD5 over
 *   orderReference;status;time
 * body shape {orderReference, status, time, signature}.
 */

// ── Credentials ──────────────────────────────────────────────────────────────

export type WayForPayCredentials = {
  merchantAccount: string;
  merchantSecret: string;
  merchantDomain: string;
};

/** Read at call time — a redeploy with new env is all it takes to switch merchants. */
function readCredentials(): WayForPayCredentials | null {
  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT?.trim();
  const merchantSecret = process.env.WAYFORPAY_MERCHANT_SECRET?.trim();
  const merchantDomain = process.env.WAYFORPAY_MERCHANT_DOMAIN?.trim();
  if (!merchantAccount || !merchantSecret || !merchantDomain) return null;
  // WayForPay's public TEST merchant has a PUBLISHED secret — in production it
  // would let anyone self-sign an Approved callback and publish for free.
  // Refusing here turns that misconfiguration into "payments unavailable"
  // (checkout errors loudly) instead of an open cash register.
  if (
    process.env.NODE_ENV === "production" &&
    merchantAccount.toLowerCase().startsWith("test_merch")
  ) {
    console.error(
      JSON.stringify({
        level: "error",
        module: "wayforpay",
        msg: "TEST merchant account in production — payments disabled",
      }),
    );
    return null;
  }
  return { merchantAccount, merchantSecret, merchantDomain };
}

export function isPaymentsConfigured(): boolean {
  return readCredentials() !== null;
}

/** Offer price in UAH. Integer env, default 999 (landing copy must match). */
export function priceUah(): number {
  const n = Number.parseInt(process.env.PRICE_UAH ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 999;
}

// ── Primitives ───────────────────────────────────────────────────────────────

function hmacMd5(secret: string, base: string): string {
  return createHmac("md5", secret).update(base, "utf8").digest("hex");
}

/**
 * Money as WayForPay writes it: no forced decimals (their own example signs
 * "1000" and "547.36" side by side). Strings pass through untouched so a caller
 * that already has the exact wire text keeps it byte-identical.
 */
export function amountStr(value: number | string): string {
  if (typeof value === "string") return value;
  return String(Math.round(value * 100) / 100);
}

/** null/undefined sign as the empty string (declined callbacks omit authCode). */
function fieldStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

// ── Purchase request ─────────────────────────────────────────────────────────

export type PurchaseProduct = {
  name: string;
  count: number | string;
  price: number | string;
};

/**
 * The exact string that gets HMAC'd for a Purchase request. Exported because
 * field order is the one thing worth asserting against the official example.
 */
export function purchaseSignatureBase(input: {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  orderDate: number | string;
  amount: number | string;
  currency: string;
  products: PurchaseProduct[];
}): string {
  return [
    input.merchantAccount,
    input.merchantDomainName,
    input.orderReference,
    String(input.orderDate),
    amountStr(input.amount),
    input.currency,
    ...input.products.map((p) => p.name),
    ...input.products.map((p) => amountStr(p.count)),
    ...input.products.map((p) => amountStr(p.price)),
  ].join(";");
}

export type PurchaseInput = {
  orderReference: string;
  amount: number;
  productName: string;
  /** Unix seconds; defaults to now. Explicit in tests. */
  orderDate?: number;
  currency?: string;
  productCount?: number;
  productPrice?: number;
  returnUrl?: string;
  serviceUrl?: string;
  clientEmail?: string;
  clientPhone?: string;
  /** Interface language of the hosted page. */
  language?: string;
};

export type Checkout = {
  action: string;
  fields: Record<string, string>;
};

/**
 * Build the auto-submit form for the hosted page. Array fields carry the `[]`
 * suffix WayForPay's own HTML example uses; the signature is computed from the
 * SAME strings that go into `fields`, so the two can never drift.
 *
 * Throws when credentials are missing — callers must gate on
 * isPaymentsConfigured() and show a Ukrainian message instead.
 */
export function buildPurchaseFields(input: PurchaseInput): Checkout {
  const creds = readCredentials();
  if (!creds) throw new Error("WayForPay is not configured");

  const currency = input.currency ?? "UAH";
  const orderDate = input.orderDate ?? Math.floor(Date.now() / 1000);
  const product: PurchaseProduct = {
    name: input.productName,
    count: input.productCount ?? 1,
    price: input.productPrice ?? input.amount,
  };

  const signature = hmacMd5(
    creds.merchantSecret,
    purchaseSignatureBase({
      merchantAccount: creds.merchantAccount,
      merchantDomainName: creds.merchantDomain,
      orderReference: input.orderReference,
      orderDate,
      amount: input.amount,
      currency,
      products: [product],
    }),
  );

  const fields: Record<string, string> = {
    merchantAccount: creds.merchantAccount,
    merchantDomainName: creds.merchantDomain,
    merchantTransactionSecureType: "AUTO",
    orderReference: input.orderReference,
    orderDate: String(orderDate),
    amount: amountStr(input.amount),
    currency,
    "productName[]": product.name,
    "productCount[]": amountStr(product.count),
    "productPrice[]": amountStr(product.price),
    language: input.language ?? "UA",
    merchantSignature: signature,
  };
  if (input.returnUrl) fields.returnUrl = input.returnUrl;
  if (input.serviceUrl) fields.serviceUrl = input.serviceUrl;
  if (input.clientEmail) fields.clientEmail = input.clientEmail;
  if (input.clientPhone) fields.clientPhone = input.clientPhone;

  return { action: WAYFORPAY_PAY_URL, fields };
}

// ── serviceUrl callback ──────────────────────────────────────────────────────

/**
 * Callback payload. Only the signed fields are required; everything else is
 * advisory (WayForPay adds fields over time, so unknown keys are kept, not
 * rejected — a stricter schema would reject real money).
 */
export const servicePayloadSchema = z
  .object({
    merchantAccount: z.string(),
    orderReference: z.string(),
    merchantSignature: z.string(),
    amount: z.union([z.string(), z.number()]),
    currency: z.string(),
    authCode: z.union([z.string(), z.number()]).nullish(),
    cardPan: z.string().nullish(),
    transactionStatus: z.string(),
    reasonCode: z.union([z.string(), z.number()]).nullish(),
    reason: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.union([z.string(), z.number()]).nullish(),
    fee: z.union([z.string(), z.number()]).nullish(),
    paymentSystem: z.string().nullish(),
  })
  .loose();

export type ServicePayload = z.infer<typeof servicePayloadSchema>;

/**
 * WayForPay posts the callback either as a JSON body or as form-encoded data
 * whose single key is the JSON string. Accept both, plus a `data=` style body,
 * and return null when nothing parses — the route must answer, never throw.
 */
export function parseServicePayload(raw: string): ServicePayload | null {
  const candidates: unknown[] = [];

  const asJson = tryJson(raw);
  if (asJson !== undefined) candidates.push(asJson);

  // Form-encoded: the whole JSON document arrives as a parameter NAME with an
  // empty value (WayForPay's classic behaviour), or as a normal `key=value`.
  if (raw.includes("=") || raw.includes("%")) {
    const params = new URLSearchParams(raw);
    for (const [key, value] of params.entries()) {
      const fromValue = tryJson(value);
      if (fromValue !== undefined) candidates.push(fromValue);
      const fromKey = tryJson(key);
      if (fromKey !== undefined) candidates.push(fromKey);
    }
  }

  for (const candidate of candidates) {
    const parsed = servicePayloadSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function tryJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * Verify the callback HMAC. Fail-closed: any doubt returns false and the order
 * keeps its current state.
 *
 * The amount arrives inside JSON, so `999.00` on the wire reaches us as the
 * number 999 and its original text is unrecoverable. We therefore try the
 * plausible renderings of that one numeric field. This does not weaken the
 * check — every candidate is still HMAC'd with the secret, so forging any of
 * them requires the secret exactly as before.
 */
export function verifyServiceSignature(payload: ServicePayload): boolean {
  const creds = readCredentials();
  if (!creds) return false;

  const provided = payload.merchantSignature?.toLowerCase();
  if (!provided) return false;

  for (const amount of amountCandidates(payload.amount)) {
    const base = SIGNATURE_CALLBACK_FIELDS.map((field) =>
      field === "amount" ? amount : fieldStr(payload[field]),
    ).join(";");
    if (timingSafeEqualHex(hmacMd5(creds.merchantSecret, base), provided)) return true;
  }
  return false;
}

/** `999` on the wire may have been written `999`, `999.0` or `999.00`. */
function amountCandidates(value: number | string): string[] {
  if (typeof value === "string") return [value];
  const out = new Set<string>([amountStr(value), value.toFixed(2), value.toFixed(1)]);
  return [...out];
}

/** Constant-time compare of two hex digests of equal length. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type ServiceResponse = {
  orderReference: string;
  status: "accept";
  time: number;
  signature: string;
};

/**
 * The acknowledgement WayForPay expects. Always "accept": it means "callback
 * received", not "payment accepted" — withholding it just makes them retry.
 * Order state is decided separately, from transactionStatus.
 */
export function buildServiceResponse(
  orderReference: string,
  time: number = Math.floor(Date.now() / 1000),
): ServiceResponse {
  const creds = readCredentials();
  const status = "accept" as const;
  const base = [orderReference, status, String(time)].join(";");
  return {
    orderReference,
    status,
    time,
    signature: creds ? hmacMd5(creds.merchantSecret, base) : "",
  };
}

// ── Status mapping ───────────────────────────────────────────────────────────

/** orders.status domain (migration 0009 CHECK constraint). */
export type OrderStatus = "pending" | "paid" | "declined" | "refunded" | "expired";

/**
 * transactionStatus → our order status (docs 852131). Anything still in flight
 * maps to null: leave the order alone and wait for the next callback.
 */
export function mapTransactionStatus(transactionStatus: string): OrderStatus | null {
  switch (transactionStatus) {
    case "Approved":
      return "paid";
    case "Declined":
    case "Voided":
      return "declined";
    case "Expired":
      return "expired";
    case "Refunded":
      return "refunded";
    default:
      return null; // InProcessing, Pending, WaitingAuthComplete, RefundInProcessing
  }
}
