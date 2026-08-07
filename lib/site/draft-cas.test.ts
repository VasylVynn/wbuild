import { describe, expect, it } from "vitest";
import { casUpdateDraft, readContentRev, type DraftCasClient } from "./draft-cas";
import type { PageContent } from "./page-content";

/**
 * contentRev CAS (pipeline v2 §9): every async draft writer goes through
 * casUpdateDraft, so these tests pin the whole write discipline — the bumped
 * rev in the payload, the genToken identity filter, the coalesce semantics for
 * pre-v2 rows, and the stale/error abort signals the writers act on.
 */

interface Captured {
  table?: string;
  payload?: { draft_content: PageContent };
  eq: Array<[string, unknown]>;
  or: string[];
}

function fakeSb(result: { data?: Array<{ id: string }>; error?: { message: string } | null }): {
  sb: DraftCasClient;
  captured: Captured;
} {
  const captured: Captured = { eq: [], or: [] };
  const q = {
    update(payload: { draft_content: PageContent }) {
      captured.payload = payload;
      return q;
    },
    eq(col: string, val: unknown) {
      captured.eq.push([col, val]);
      return q;
    },
    or(filter: string) {
      captured.or.push(filter);
      return q;
    },
    select() {
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  };
  const sb = {
    from(table: string) {
      captured.table = table;
      return q;
    },
  } as unknown as DraftCasClient;
  return { sb, captured };
}

const content: PageContent = { blocks: [], genToken: "tok-1", contentRev: 4 };

describe("casUpdateDraft", () => {
  it("writes contentRev+1 and filters on pageId + genToken + the read rev", async () => {
    const { sb, captured } = fakeSb({ data: [{ id: "p1" }] });
    const res = await casUpdateDraft(sb, { pageId: "p1", genToken: "tok-1", contentRev: 4 }, content);
    expect(res).toEqual({ ok: true, nextRev: 5 });
    expect(captured.table).toBe("pages");
    expect(captured.payload?.draft_content.contentRev).toBe(5);
    expect(captured.eq).toContainEqual(["id", "p1"]);
    expect(captured.eq).toContainEqual(["draft_content->>genToken", "tok-1"]);
    expect(captured.eq).toContainEqual(["draft_content->>contentRev", "4"]);
    expect(captured.or).toEqual([]);
  });

  it("rev 0 matches a pre-v2 NULL via the coalesce OR filter", async () => {
    const { sb, captured } = fakeSb({ data: [{ id: "p1" }] });
    const res = await casUpdateDraft(sb, { pageId: "p1", contentRev: 0 }, content);
    expect(res).toEqual({ ok: true, nextRev: 1 });
    expect(captured.or).toEqual([
      "draft_content->>contentRev.is.null,draft_content->>contentRev.eq.0",
    ]);
    // No exact-rev eq filter alongside the OR, and no genToken filter when
    // none was passed.
    expect(captured.eq).toEqual([["id", "p1"]]);
  });

  it("zero matched rows reads as STALE — the caller must abort, not retry blindly", async () => {
    const { sb } = fakeSb({ data: [] });
    const res = await casUpdateDraft(sb, { pageId: "p1", genToken: "old", contentRev: 4 }, content);
    expect(res).toEqual({ ok: false, stale: true });
  });

  it("a DB error is surfaced, never swallowed (the old inspect.ts bug)", async () => {
    const { sb } = fakeSb({ error: { message: "boom" } });
    const res = await casUpdateDraft(sb, { pageId: "p1", contentRev: 4 }, content);
    expect(res).toEqual({ ok: false, stale: false, error: "boom" });
  });
});

describe("readContentRev", () => {
  it("reads the rev, coalescing absent/garbage to 0", () => {
    expect(readContentRev({ blocks: [], contentRev: 7 })).toBe(7);
    expect(readContentRev({ blocks: [] })).toBe(0);
    expect(readContentRev(undefined)).toBe(0);
    expect(readContentRev({ blocks: [], contentRev: Number.NaN })).toBe(0);
  });
});
