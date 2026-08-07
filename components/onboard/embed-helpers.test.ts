import { describe, expect, it } from "vitest";
import { appUrl, convFromNext, shouldRestoreConversation } from "./embed-helpers";

/**
 * ROOT_DOMAIN in the vitest env is the config default (lvh.me:3000 — no
 * NEXT_PUBLIC_ROOT_DOMAIN set), so the dev protocol rules apply: http + port.
 */

describe("appUrl", () => {
  it("builds absolute app-host URLs from root-relative paths", () => {
    expect(appUrl("/login?next=/new")).toBe("http://app.lvh.me:3000/login?next=/new");
    expect(appUrl("/sites")).toBe("http://app.lvh.me:3000/sites");
    expect(appUrl("/edit/kviti.lvh.me/frame")).toBe(
      "http://app.lvh.me:3000/edit/kviti.lvh.me/frame",
    );
  });

  it("defaults to the app-host root", () => {
    expect(appUrl()).toBe("http://app.lvh.me:3000/");
  });

  it("passes already-absolute URLs through untouched", () => {
    expect(appUrl("https://app.3minsite.com.ua/sites")).toBe(
      "https://app.3minsite.com.ua/sites",
    );
    expect(appUrl("http://other.example/x")).toBe("http://other.example/x");
  });
});

describe("convFromNext", () => {
  it("extracts the conversation id from a /new handoff path", () => {
    expect(convFromNext("/new?conv=abc-123&resume=1")).toBe("abc-123");
    expect(convFromNext("/new?conv=abc-123")).toBe("abc-123");
  });

  it("returns null for non-/new paths, missing or empty conv", () => {
    expect(convFromNext(null)).toBe(null);
    expect(convFromNext(undefined)).toBe(null);
    expect(convFromNext("/sites")).toBe(null);
    expect(convFromNext("/new")).toBe(null);
    expect(convFromNext("/new?resume=1")).toBe(null);
    expect(convFromNext("/new?conv=")).toBe(null);
    expect(convFromNext("/edit/x?conv=abc")).toBe(null);
  });

  it("requires a /new path boundary — sibling paths never match", () => {
    expect(convFromNext("/newsletter?conv=abc")).toBe(null);
    expect(convFromNext("/news?conv=abc")).toBe(null);
    expect(convFromNext("/new/sub?conv=abc")).toBe(null);
  });
});

describe("shouldRestoreConversation", () => {
  const msgs = (n: number) => Array.from({ length: n }, () => ({}));

  it("never restores a missing conversation or one without real back-and-forth", () => {
    expect(shouldRestoreConversation(null, false)).toBe(false);
    expect(shouldRestoreConversation(null, true)).toBe(false);
    expect(shouldRestoreConversation({ messages: msgs(0) }, false)).toBe(false);
    expect(shouldRestoreConversation({ messages: msgs(1) }, true)).toBe(false);
  });

  it("full mode restores any real conversation, draft or not (W0/V2 behavior)", () => {
    expect(shouldRestoreConversation({ messages: msgs(3) }, false)).toBe(true);
    expect(shouldRestoreConversation({ messages: msgs(3), host: "x.lvh.me" }, false)).toBe(
      true,
    );
  });

  it("embedded restores only in-progress conversations (no draft yet)", () => {
    expect(shouldRestoreConversation({ messages: msgs(3) }, true)).toBe(true);
    expect(shouldRestoreConversation({ messages: msgs(3), host: "x.lvh.me" }, true)).toBe(
      false,
    );
  });
});
