import { afterEach, describe, expect, it, vi } from "vitest";
import {
  advanceDesignNonce,
  designSeed,
  mulberry32,
  nonceForBrandWrite,
  type NonceClient,
} from "./seed";

/** Build a NonceClient mock: `rpc` result + a brand row for the fallback read. */
function mockClient(opts: {
  rpc: { data: unknown; error: { message: string } | null } | "throws";
  read?: { data: unknown; error: { message: string } | null };
}) {
  const rpc = vi.fn(async () => {
    if (opts.rpc === "throws") throw new Error("network down");
    return opts.rpc;
  });
  const maybeSingle = vi.fn(async () => opts.read ?? { data: null, error: null });
  const client = {
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  } as unknown as NonceClient;
  return { client, rpc, maybeSingle };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("advanceDesignNonce", () => {
  it("returns the RPC's value and never reads on the atomic path", async () => {
    const { client, maybeSingle } = mockClient({ rpc: { data: 7, error: null } });
    await expect(advanceDesignNonce(client, "kvity.lvh.me")).resolves.toBe(7);
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("RPC missing → warns once and falls back to read+1", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, maybeSingle } = mockClient({
      rpc: { data: null, error: { message: "function design_nonce_bump does not exist" } },
      read: { data: { brand: { designNonce: 3 } }, error: null },
    });
    await expect(advanceDesignNonce(client, "kvity.lvh.me")).resolves.toBe(4);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("fallback on a fresh host (no tenant row) starts at 0", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = mockClient({ rpc: "throws", read: { data: null, error: null } });
    await expect(advanceDesignNonce(client, "new.lvh.me")).resolves.toBe(0);
  });

  it("fallback treats a garbage stored nonce as absent", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = mockClient({
      rpc: { data: "not-a-number", error: null }, // malformed RPC result → fallback too
      read: { data: { brand: { designNonce: "9" } }, error: null },
    });
    await expect(advanceDesignNonce(client, "kvity.lvh.me")).resolves.toBe(0);
  });

  it("fallback READ failure throws — it must not masquerade as a new tenant", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = mockClient({
      rpc: "throws",
      read: { data: null, error: { message: "connection reset" } },
    });
    await expect(advanceDesignNonce(client, "kvity.lvh.me")).rejects.toThrow(
      "design nonce read failed",
    );
  });
});

describe("nonceForBrandWrite", () => {
  it("two interleaved advance→write cycles never leave the stored nonce below the highest issued", () => {
    // A takes 6, B takes 7 (RPC serialized, DB=7). B writes first, then A
    // finishes last with a fresh base carrying 7 — A must NOT reset 7→6.
    let stored: unknown = nonceForBrandWrite(7, 6); // B's write over base 6
    expect(stored).toBe(7);
    stored = nonceForBrandWrite(6, stored); // A's write over fresh base 7
    expect(stored).toBe(7);
  });

  it("read+1 fallback (base one behind the issued nonce) persists the issued one", () => {
    expect(nonceForBrandWrite(4, 3)).toBe(4);
  });

  it("missing or garbage base nonce keeps the issued value", () => {
    expect(nonceForBrandWrite(5, undefined)).toBe(5);
    expect(nonceForBrandWrite(5, "9")).toBe(5);
    expect(nonceForBrandWrite(5, Number.NaN)).toBe(5);
  });
});

describe("designSeed/mulberry32 (regression)", () => {
  it("same inputs reproduce the same stream", () => {
    const a = mulberry32(designSeed("kvity.lvh.me:hue", 2));
    const b = mulberry32(designSeed("kvity.lvh.me:hue", 2));
    expect(a()).toBe(b());
  });
});
