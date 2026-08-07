import { describe, expect, it } from "vitest";
import { appUrl, shouldRestoreConversation } from "./embed-helpers";

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
