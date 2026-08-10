import { describe, expect, it } from "vitest";
import { pickNewestSnapshot, type SnapshotOrderKey } from "./snapshots";

/**
 * The snapshot resolution ORDER (provenance contract, lib/ig/snapshots.ts).
 * `getLatestSnapshot` probes two scopes — the tenant, and every conversation
 * belonging to that tenant — and this pure picker decides which candidate wins.
 * It is the piece that made a tenant-keyed read stop returning null for sites
 * onboarded before the tenant link existed, so its ordering is pinned here.
 */

const row = (over: Partial<SnapshotOrderKey> & { id: string }): SnapshotOrderKey => ({
  tenant_id: null,
  scraped_at: "2026-08-01T00:00:00Z",
  ...over,
});

describe("pickNewestSnapshot", () => {
  it("returns null for no candidates", () => {
    expect(pickNewestSnapshot([])).toBeNull();
  });

  it("takes the newest scraped_at across scopes", () => {
    const tenantScoped = row({ id: "a", tenant_id: "t1", scraped_at: "2026-08-01T00:00:00Z" });
    const conversationScoped = row({ id: "b", scraped_at: "2026-08-10T08:53:34Z" });
    expect(pickNewestSnapshot([tenantScoped, conversationScoped])?.id).toBe("b");
    // Order of the probe results must not matter.
    expect(pickNewestSnapshot([conversationScoped, tenantScoped])?.id).toBe("b");
  });

  it("falls back to the conversation-scoped row when the tenant scope is empty", () => {
    // The tennis case: the only row for this tenant is reachable via its
    // conversation, because tenant_id was never written.
    const orphan = row({ id: "san-team", scraped_at: "2026-08-10T08:53:34Z" });
    expect(pickNewestSnapshot([orphan])).toEqual(orphan);
  });

  it("prefers the tenant-linked row on an exact timestamp tie", () => {
    // Both probes return THE SAME row after a backfill; dedupe by id keeps one.
    const linked = row({ id: "a", tenant_id: "t1" });
    const unlinked = row({ id: "b" });
    expect(pickNewestSnapshot([unlinked, linked])?.id).toBe("a");
  });

  it("dedupes by id so a row matched by both scopes is not double-counted", () => {
    const same = row({ id: "a", tenant_id: "t1" });
    expect(pickNewestSnapshot([same, { ...same }])).toEqual(same);
  });

  it("breaks a full tie deterministically by id", () => {
    const a = row({ id: "a", tenant_id: "t1" });
    const b = row({ id: "b", tenant_id: "t1" });
    expect(pickNewestSnapshot([b, a])?.id).toBe("a");
    expect(pickNewestSnapshot([a, b])?.id).toBe("a");
  });

  it("never lets an unparseable timestamp shadow a good row", () => {
    const corrupt = row({ id: "a", tenant_id: "t1", scraped_at: "not-a-date" });
    const good = row({ id: "b", scraped_at: "2026-01-01T00:00:00Z" });
    expect(pickNewestSnapshot([corrupt, good])?.id).toBe("b");
  });

  it("still returns the corrupt row when it is the only candidate", () => {
    const corrupt = row({ id: "a", scraped_at: "" });
    expect(pickNewestSnapshot([corrupt])?.id).toBe("a");
  });
});
