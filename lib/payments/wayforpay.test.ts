import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  WAYFORPAY_PAY_URL,
  amountStr,
  buildPurchaseFields,
  buildServiceResponse,
  isPaymentsConfigured,
  mapTransactionStatus,
  parseServicePayload,
  priceUah,
  purchaseSignatureBase,
  servicePayloadSchema,
  verifyServiceSignature,
  type ServicePayload,
} from "./wayforpay";

/**
 * Signature tests for the money path. The fixtures come from the official docs
 * (https://wiki.wayforpay.com/en/view/852102, fetched 2026-08-05).
 *
 * NOTE on the doc's published hash: WayForPay prints the example input string
 * together with the digest b95932786cbe243a76b014846b63fe92, but does NOT print
 * the secret key that produced it — and neither published test-merchant secret
 * reproduces it. So we assert the two things we actually can:
 *   1. our builder reproduces the documented INPUT STRING byte-for-byte
 *      (field order is the part that's easy to get wrong and impossible to
 *      detect except against real money), and
 *   2. the HMAC step itself is a plain HMAC-MD5 over that string.
 */

const SECRET = "flk3409refn54t54t*FNJRET";

function setEnv() {
  process.env.WAYFORPAY_MERCHANT_ACCOUNT = "test_merchant";
  process.env.WAYFORPAY_MERCHANT_SECRET = SECRET;
  process.env.WAYFORPAY_MERCHANT_DOMAIN = "www.market.ua";
}

function clearEnv() {
  delete process.env.WAYFORPAY_MERCHANT_ACCOUNT;
  delete process.env.WAYFORPAY_MERCHANT_SECRET;
  delete process.env.WAYFORPAY_MERCHANT_DOMAIN;
  delete process.env.PRICE_UAH;
}

beforeEach(setEnv);
afterEach(clearEnv);

const hmac = (base: string, secret = SECRET) =>
  createHmac("md5", secret).update(base, "utf8").digest("hex");

// ── Purchase request ─────────────────────────────────────────────────────────

describe("purchaseSignatureBase", () => {
  /** The official multi-product example, verbatim from the docs. */
  const OFFICIAL_BASE =
    "test_merchant;www.market.ua;DH783023;1415379863;1547.36;UAH;" +
    "Процесор Intel Core i5-4670 3.4GHz;Пам'ять Kingston DDR3-1600 4096MB PC3-12800;" +
    "1;1;1000;547.36";

  it("reproduces the documented example string exactly", () => {
    const base = purchaseSignatureBase({
      merchantAccount: "test_merchant",
      merchantDomainName: "www.market.ua",
      orderReference: "DH783023",
      orderDate: 1415379863,
      amount: 1547.36,
      currency: "UAH",
      products: [
        { name: "Процесор Intel Core i5-4670 3.4GHz", count: 1, price: 1000 },
        { name: "Пам'ять Kingston DDR3-1600 4096MB PC3-12800", count: 1, price: 547.36 },
      ],
    });
    expect(base).toBe(OFFICIAL_BASE);
  });

  it("groups all names, then all counts, then all prices (not per-product tuples)", () => {
    const base = purchaseSignatureBase({
      merchantAccount: "m",
      merchantDomainName: "d",
      orderReference: "o",
      orderDate: 1,
      amount: 3,
      currency: "UAH",
      products: [
        { name: "A", count: 1, price: 1 },
        { name: "B", count: 2, price: 2 },
      ],
    });
    expect(base).toBe("m;d;o;1;3;UAH;A;B;1;2;1;2");
  });
});

describe("buildPurchaseFields", () => {
  it("signs exactly the values it posts", () => {
    const { action, fields } = buildPurchaseFields({
      orderReference: "wfp_abcd1234_xyz",
      amount: 999,
      productName: "Сайт + домен на 1 рік",
      orderDate: 1754400000,
    });

    expect(action).toBe(WAYFORPAY_PAY_URL);

    // Rebuild the base from the POSTED fields — if the builder ever signs
    // something other than what it sends, this diverges.
    const expected = hmac(
      [
        fields.merchantAccount,
        fields.merchantDomainName,
        fields.orderReference,
        fields.orderDate,
        fields.amount,
        fields.currency,
        fields["productName[]"],
        fields["productCount[]"],
        fields["productPrice[]"],
      ].join(";"),
    );
    expect(fields.merchantSignature).toBe(expected);
  });

  it("fills the offer defaults", () => {
    const { fields } = buildPurchaseFields({
      orderReference: "wfp_1",
      amount: 999,
      productName: "Сайт",
      orderDate: 1754400000,
    });
    expect(fields.amount).toBe("999");
    expect(fields.currency).toBe("UAH");
    expect(fields["productCount[]"]).toBe("1");
    expect(fields["productPrice[]"]).toBe("999");
    expect(fields.language).toBe("UA");
    expect(fields.merchantTransactionSecureType).toBe("AUTO");
  });

  it("includes optional urls only when given", () => {
    const bare = buildPurchaseFields({
      orderReference: "wfp_1",
      amount: 999,
      productName: "Сайт",
    }).fields;
    expect(bare.returnUrl).toBeUndefined();
    expect(bare.serviceUrl).toBeUndefined();

    const full = buildPurchaseFields({
      orderReference: "wfp_1",
      amount: 999,
      productName: "Сайт",
      returnUrl: "https://app.example.com/pay/result",
      serviceUrl: "https://app.example.com/api/payments/wayforpay",
    }).fields;
    expect(full.returnUrl).toBe("https://app.example.com/pay/result");
    expect(full.serviceUrl).toBe("https://app.example.com/api/payments/wayforpay");
  });

  it("throws when credentials are missing (never silently unsigned)", () => {
    clearEnv();
    expect(() =>
      buildPurchaseFields({ orderReference: "wfp_1", amount: 999, productName: "Сайт" }),
    ).toThrow();
  });
});

describe("isPaymentsConfigured / priceUah", () => {
  it("is true only with all three credentials", () => {
    expect(isPaymentsConfigured()).toBe(true);
    delete process.env.WAYFORPAY_MERCHANT_DOMAIN;
    expect(isPaymentsConfigured()).toBe(false);
  });

  it("defaults the price to 999 and honours a valid override", () => {
    expect(priceUah()).toBe(999);
    process.env.PRICE_UAH = "1499";
    expect(priceUah()).toBe(1499);
    process.env.PRICE_UAH = "nonsense";
    expect(priceUah()).toBe(999);
  });
});

describe("amountStr", () => {
  it("writes money the way WayForPay's own example does", () => {
    expect(amountStr(1000)).toBe("1000");
    expect(amountStr(547.36)).toBe("547.36");
    expect(amountStr(999)).toBe("999");
    expect(amountStr("999.00")).toBe("999.00"); // caller-supplied wire text wins
  });
});

// ── Callback verification ────────────────────────────────────────────────────

/** Callback base: merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode */
function signedCallback(over: Partial<ServicePayload> = {}): ServicePayload {
  const p = {
    merchantAccount: "test_merchant",
    orderReference: "wfp_abcd1234_xyz",
    amount: 999,
    currency: "UAH",
    authCode: "54321",
    cardPan: "44**44",
    transactionStatus: "Approved",
    reasonCode: 1100,
    ...over,
  };
  const base = [
    p.merchantAccount,
    p.orderReference,
    p.amount,
    p.currency,
    p.authCode,
    p.cardPan,
    p.transactionStatus,
    p.reasonCode,
  ].join(";");
  return { ...p, merchantSignature: hmac(base) } as ServicePayload;
}

describe("verifyServiceSignature", () => {
  it("accepts a correctly signed callback", () => {
    expect(verifyServiceSignature(signedCallback())).toBe(true);
  });

  it("rejects a tampered amount", () => {
    const payload = { ...signedCallback(), amount: 1 };
    expect(verifyServiceSignature(payload)).toBe(false);
  });

  it("rejects a tampered transactionStatus (the field that moves money)", () => {
    const declined = signedCallback({ transactionStatus: "Declined" });
    expect(verifyServiceSignature({ ...declined, transactionStatus: "Approved" })).toBe(false);
  });

  it("rejects a garbage signature", () => {
    expect(verifyServiceSignature({ ...signedCallback(), merchantSignature: "deadbeef" })).toBe(
      false,
    );
    expect(verifyServiceSignature({ ...signedCallback(), merchantSignature: "" })).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const p = signedCallback();
    const base = ["test_merchant", p.orderReference, "999", "UAH", "54321", "44**44", "Approved", "1100"].join(
      ";",
    );
    expect(verifyServiceSignature({ ...p, merchantSignature: hmac(base, "wrong-secret") })).toBe(
      false,
    );
  });

  it("fails closed when the merchant secret is absent", () => {
    const payload = signedCallback();
    clearEnv();
    expect(verifyServiceSignature(payload)).toBe(false);
  });

  it("accepts an amount that was written with trailing decimals on the wire", () => {
    // WayForPay signed "999.00"; JSON.parse handed us the number 999.
    const base = ["test_merchant", "wfp_1", "999.00", "UAH", "54321", "44**44", "Approved", "1100"].join(
      ";",
    );
    const payload = servicePayloadSchema.parse({
      merchantAccount: "test_merchant",
      orderReference: "wfp_1",
      amount: 999,
      currency: "UAH",
      authCode: "54321",
      cardPan: "44**44",
      transactionStatus: "Approved",
      reasonCode: 1100,
      merchantSignature: hmac(base),
    });
    expect(verifyServiceSignature(payload)).toBe(true);
  });

  it("treats a missing authCode as an empty segment (declined callbacks)", () => {
    const base = ["test_merchant", "wfp_1", "999", "UAH", "", "", "Declined", "1101"].join(";");
    const payload = servicePayloadSchema.parse({
      merchantAccount: "test_merchant",
      orderReference: "wfp_1",
      amount: 999,
      currency: "UAH",
      transactionStatus: "Declined",
      reasonCode: 1101,
      merchantSignature: hmac(base),
    });
    expect(verifyServiceSignature(payload)).toBe(true);
  });
});

// ── Callback response ────────────────────────────────────────────────────────

describe("buildServiceResponse", () => {
  it("signs orderReference;status;time", () => {
    const res = buildServiceResponse("wfp_abcd1234_xyz", 1754400000);
    expect(res).toEqual({
      orderReference: "wfp_abcd1234_xyz",
      status: "accept",
      time: 1754400000,
      signature: hmac("wfp_abcd1234_xyz;accept;1754400000"),
    });
  });

  it("still answers (unsigned) when credentials are missing", () => {
    clearEnv();
    const res = buildServiceResponse("wfp_1", 1754400000);
    expect(res.status).toBe("accept");
    expect(res.signature).toBe("");
  });
});

// ── Payload parsing ──────────────────────────────────────────────────────────

describe("parseServicePayload", () => {
  const json = JSON.stringify({
    merchantAccount: "test_merchant",
    orderReference: "wfp_1",
    merchantSignature: "abc",
    amount: 999,
    currency: "UAH",
    authCode: "1",
    cardPan: "44**44",
    transactionStatus: "Approved",
    reasonCode: 1100,
  });

  it("parses a raw JSON body", () => {
    const parsed = parseServicePayload(json);
    expect(parsed?.orderReference).toBe("wfp_1");
    expect(parsed?.transactionStatus).toBe("Approved");
  });

  it("parses form-encoded bodies where the JSON is the parameter NAME", () => {
    const body = new URLSearchParams();
    body.append(json, "");
    expect(parseServicePayload(body.toString())?.orderReference).toBe("wfp_1");
  });

  it("parses form-encoded bodies where the JSON is a parameter VALUE", () => {
    const body = new URLSearchParams({ data: json });
    expect(parseServicePayload(body.toString())?.orderReference).toBe("wfp_1");
  });

  it("keeps unknown fields instead of rejecting them", () => {
    const parsed = parseServicePayload(
      JSON.stringify({ ...JSON.parse(json), someFutureField: "x" }),
    );
    expect(parsed).not.toBeNull();
    expect((parsed as Record<string, unknown>).someFutureField).toBe("x");
  });

  it("returns null for garbage", () => {
    expect(parseServicePayload("")).toBeNull();
    expect(parseServicePayload("not json at all")).toBeNull();
    expect(parseServicePayload("{broken")).toBeNull();
    expect(parseServicePayload(JSON.stringify({ hello: "world" }))).toBeNull();
    // Right shape, wrong types.
    expect(
      parseServicePayload(JSON.stringify({ merchantAccount: 1, orderReference: [], amount: {} })),
    ).toBeNull();
  });
});

// ── Status mapping ───────────────────────────────────────────────────────────

describe("mapTransactionStatus", () => {
  it("maps terminal statuses", () => {
    expect(mapTransactionStatus("Approved")).toBe("paid");
    expect(mapTransactionStatus("Declined")).toBe("declined");
    expect(mapTransactionStatus("Voided")).toBe("declined");
    expect(mapTransactionStatus("Expired")).toBe("expired");
    expect(mapTransactionStatus("Refunded")).toBe("refunded");
  });

  it("leaves in-flight statuses alone", () => {
    expect(mapTransactionStatus("InProcessing")).toBeNull();
    expect(mapTransactionStatus("Pending")).toBeNull();
    expect(mapTransactionStatus("WaitingAuthComplete")).toBeNull();
    expect(mapTransactionStatus("")).toBeNull();
  });
});
