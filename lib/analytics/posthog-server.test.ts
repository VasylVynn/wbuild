import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract that matters for posthog-server: it is invisible without a key,
 * it uses the immediate (non-queued) send path so a frozen lambda cannot drop
 * the event, and it NEVER rejects — callers on the funnel and the money path
 * await it without a try/catch.
 *
 * `vi.hoisted` so the spies survive the resetModules() each test does to get a
 * fresh module (and therefore a fresh lazy singleton).
 */

const sdk = vi.hoisted(() => ({
  construct: vi.fn(),
  captureImmediate: vi.fn(async () => {}),
  captureExceptionImmediate: vi.fn(async () => {}),
  capture: vi.fn(),
  shutdown: vi.fn(),
}));

vi.mock("posthog-node", () => ({
  PostHog: class {
    captureImmediate = sdk.captureImmediate;
    captureExceptionImmediate = sdk.captureExceptionImmediate;
    capture = sdk.capture;
    shutdown = sdk.shutdown;
    constructor(key: string, options: unknown) {
      sdk.construct(key, options);
    }
  },
}));

async function load() {
  vi.resetModules();
  return import("./posthog-server");
}

beforeEach(() => {
  vi.clearAllMocks();
  // log.warn writes to console; keep the swallow tests quiet.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
});

describe("no key configured", () => {
  it("never constructs a client and never touches the network", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const { phServerCapture, phServerException } = await load();

    await expect(phServerCapture("payment_success", "tenant-1")).resolves.toBeUndefined();
    await expect(phServerException(new Error("x"), "tenant-1")).resolves.toBeUndefined();

    expect(sdk.construct).not.toHaveBeenCalled();
    expect(sdk.captureImmediate).not.toHaveBeenCalled();
    expect(sdk.captureExceptionImmediate).not.toHaveBeenCalled();
  });

  it("treats a blank key as absent", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "   ";
    const { phServerCapture } = await load();

    await phServerCapture("chat_start", "conv-1");
    expect(sdk.construct).not.toHaveBeenCalled();
  });
});

describe("client construction", () => {
  it("uses the serverless flush settings and the EU host by default", async () => {
    const { phServerCapture } = await load();
    await phServerCapture("chat_start", "conv-1");

    expect(sdk.construct).toHaveBeenCalledWith("phc_test", {
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 3000,
    });
  });

  it("a hung ingest cannot stall the caller past the deadline", async () => {
    vi.useFakeTimers();
    try {
      // Never resolves — simulates PostHog ingest hanging.
      sdk.captureImmediate.mockImplementationOnce(() => new Promise(() => {}));
      const { phServerCapture } = await load();

      let settled = false;
      const call = phServerCapture("publish_clicked", "tenant-1").then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(1400);
      expect(settled).toBe(false); // still inside the deadline
      await vi.advanceTimersByTimeAsync(200);
      await call;
      expect(settled).toBe(true); // released by the deadline, not the ingest
    } finally {
      vi.useRealTimers();
    }
  });

  it("honours an explicit host", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
    const { phServerCapture } = await load();
    await phServerCapture("chat_start", "conv-1");

    expect(sdk.construct).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({ host: "https://us.i.posthog.com" }),
    );
  });

  it("builds the client once and reuses it across calls", async () => {
    const { phServerCapture } = await load();
    await phServerCapture("chat_start", "conv-1");
    await phServerCapture("draft_generated", "conv-1");

    expect(sdk.construct).toHaveBeenCalledTimes(1);
    expect(sdk.captureImmediate).toHaveBeenCalledTimes(2);
  });
});

describe("phServerCapture", () => {
  it("sends via the immediate path, never the queued one", async () => {
    const { phServerCapture } = await load();
    await phServerCapture("payment_success", "tenant-7", { amount: "999" });

    expect(sdk.captureImmediate).toHaveBeenCalledWith({
      distinctId: "tenant-7",
      event: "payment_success",
      properties: { amount: "999" },
    });
    // capture() would queue and be lost when the lambda freezes.
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it("does not shut the shared singleton down", async () => {
    const { phServerCapture } = await load();
    await phServerCapture("payment_success", "tenant-7");

    expect(sdk.shutdown).not.toHaveBeenCalled();
  });

  it("falls back to anonymous for an empty distinctId", async () => {
    const { phServerCapture } = await load();
    await phServerCapture("chat_start", "");

    expect(sdk.captureImmediate).toHaveBeenCalledWith(
      expect.objectContaining({ distinctId: "anonymous" }),
    );
  });

  it("swallows a rejected SDK call", async () => {
    sdk.captureImmediate.mockRejectedValueOnce(new Error("posthog 503"));
    const { phServerCapture } = await load();

    await expect(phServerCapture("payment_success", "tenant-7")).resolves.toBeUndefined();
  });

  it("swallows a synchronously throwing SDK call", async () => {
    sdk.captureImmediate.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const { phServerCapture } = await load();

    await expect(phServerCapture("payment_success", "tenant-7")).resolves.toBeUndefined();
  });
});

describe("phServerException", () => {
  it("uses the SDK exception builder so error metadata is attached", async () => {
    const err = new Error("wayforpay exploded");
    const { phServerException } = await load();
    await phServerException(err, "order-1", { scope: "wayforpay_webhook" });

    expect(sdk.captureExceptionImmediate).toHaveBeenCalledWith(err, "order-1", {
      scope: "wayforpay_webhook",
    });
  });

  it("swallows a rejected SDK call", async () => {
    sdk.captureExceptionImmediate.mockRejectedValueOnce(new Error("posthog 503"));
    const { phServerException } = await load();

    await expect(phServerException(new Error("x"), "order-1")).resolves.toBeUndefined();
  });
});
