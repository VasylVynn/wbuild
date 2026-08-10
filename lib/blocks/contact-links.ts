/**
 * Pure normalization helpers for messenger contact links on the `contacts`
 * block (brief §4.1 chain: schema → fields → library → renderer). Freeform
 * user input (any spacing/punctuation) is normalized into a deep link.
 *
 * No React/Next imports here on purpose — keep this testable in isolation.
 */

/** Digits only, e.g. "+38 (067) 123-45-67" -> "380671234567". */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Normalize a Ukrainian-ish phone number to a bare digit string with the
 * country code, e.g. "0671234567" / "+380671234567" / "80671234567" ->
 * "380671234567". Returns "" if there aren't enough digits to be a phone.
 */
export function normalizeUaPhoneDigits(raw: string): string {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  if (digits.startsWith("0")) return `380${digits.slice(1)}`; // local "0XX..." form
  if (digits.length === 11 && digits.startsWith("80")) return `3${digits}`; // missing leading 3
  if (digits.length === 9) return `380${digits}`; // bare 9-digit local number
  return digits; // assume it already carries the country code (e.g. "380...")
}

/**
 * viber://chat deep link. `raw` is a freeform phone number (any punctuation).
 * Returns null when there's nothing usable to link to.
 */
export function viberHref(raw: string | undefined | null): string | null {
  if (!raw || !raw.trim()) return null;
  const digits = normalizeUaPhoneDigits(raw);
  if (!digits) return null;
  return `viber://chat?number=%2B${digits}`;
}

/**
 * `raw` looks like a phone number (only digits + phone punctuation, at least
 * 9 digits) rather than a @username / bare username.
 */
function isPhoneLike(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/^[+\d][\d\s\-().]*$/.test(trimmed)) return false;
  return digitsOnly(trimmed).length >= 9;
}

/**
 * Instagram handle from freeform input: bare name, "@name", or a full profile
 * URL (with or without www/query/trailing path). Returns null when nothing
 * usable remains. Shared by the site renderer (contacts/footers), the chat
 * client (link detection) and the Apify import (wave E).
 */
export function normalizeIgHandle(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim();
  const fromUrl = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) s = fromUrl[1];
  s = s.replace(/^@+/, "");
  // IG usernames: letters/digits/dot/underscore, ≤30 chars. Reserved paths
  // (instagram.com/p/…, /reel/…, /explore/…) are post links, not profiles.
  if (!/^[a-z0-9._]{1,30}$/i.test(s)) return null;
  if (["p", "reel", "reels", "tv", "stories", "explore", "accounts"].includes(s.toLowerCase())) {
    return null;
  }
  return s;
}

/** https://www.instagram.com/<handle> from freeform input, or null. */
export function instagramHref(raw: string | undefined | null): string | null {
  const handle = normalizeIgHandle(raw);
  return handle ? `https://www.instagram.com/${handle}` : null;
}

/**
 * Instagram DIRECT deep link — https://ig.me/m/<handle>. This is the href a
 * button labelled «Написати в Direct» must carry: `instagramHref` opens the
 * PROFILE, so pairing that URL with that label promises a chat and delivers a
 * feed. A button whose label does not match its target is a broken promise, and
 * the funnel (invariant 8) is the one place we cannot afford one.
 *
 * Returns null when the input holds no usable handle — the caller then renders
 * no button at all rather than a dead one.
 */
export function igDirectHref(raw: string | undefined | null): string | null {
  const handle = normalizeIgHandle(raw);
  return handle ? `https://ig.me/m/${handle}` : null;
}

/**
 * mailto: link from a freeform email fact. `contactsSchema.email` is a plain
 * `z.string()` — the owner's own text is copied 1:1 (invariant 5), so it can
 * legitimately arrive as «пошта: hello@example.com» or carry stray whitespace,
 * and interpolating it raw puts that noise inside the href. The address is
 * EXTRACTED rather than assumed; null means «render the value as plain text,
 * not as a dead link».
 */
export function mailtoHref(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  const match = raw.match(/[^\s<>()[\]",;:@]+@[^\s<>()[\]",;:@]+\.[a-z]{2,}/i);
  return match ? `mailto:${match[0]}` : null;
}

/**
 * Telegram username from freeform input: bare name, "@name", or a full
 * t.me / telegram.me profile URL. Returns null when nothing usable remains —
 * including a phone-like value (that is a `+digits` deep link, not a
 * username) and a `t.me/+invite` join link (not a profile either).
 *
 * Live-audit 2026-08-10: `facts.telegram` on a real tenant was the FULL URL
 * "https://t.me/SanTeamTennis" — a raw value in a `https://t.me/${raw}`
 * template literal produced "https://t.me/https://t.me/SanTeamTennis". Every
 * renderer and every href builder goes through here now.
 */
export function normalizeTelegramUsername(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim();
  const fromUrl = s.match(/(?:t|telegram)\.me\/([^/?#\s]+)/i);
  if (fromUrl) s = fromUrl[1];
  s = s.replace(/^@+/, "");
  // Telegram usernames: letters/digits/underscore, 5–32 chars. "+380…" join
  // links and phone numbers are handled by telegramHref, not here.
  if (!/^[a-z0-9_]{5,32}$/i.test(s)) return null;
  return s;
}

/** "@username" for display, or null when the value is not a real username. */
export function telegramLabel(raw: string | undefined | null): string | null {
  const username = normalizeTelegramUsername(raw);
  return username ? `@${username}` : null;
}

/**
 * https://t.me/... link. `raw` is either a Telegram username (bare, "@name" or
 * a full t.me URL) or a phone number (any punctuation, UA-normalized).
 * Returns null when there's nothing usable to link to.
 */
export function telegramHref(raw: string | undefined | null): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (isPhoneLike(trimmed)) {
    const digits = normalizeUaPhoneDigits(trimmed);
    if (!digits) return null;
    return `https://t.me/+${digits}`;
  }
  const username = normalizeTelegramUsername(trimmed);
  if (username) return `https://t.me/${username}`;
  // A t.me/+invite join link is a legitimate destination — keep it verbatim
  // rather than rebuilding it (rebuilding is what produced the double URL).
  const invite = trimmed.match(/(?:t|telegram)\.me\/(\+[A-Za-z0-9_-]+)/i);
  if (invite) return `https://t.me/${invite[1]}`;
  if (/^https?:\/\//i.test(trimmed)) return null; // some other URL — never a handle
  const bare = trimmed.replace(/^@+/, "");
  return bare ? `https://t.me/${bare}` : null;
}

/**
 * Canonicalize the contact facts that are IDENTITIES rather than free text:
 * `instagram` and `telegram` are stored as bare handles, so every downstream
 * consumer (grounding, QA drift check, renderer, JSON-LD) sees ONE shape.
 *
 * Not a violation of the requisites-1:1 rule (invariant 5): the handle is the
 * same identity written canonically, never a different or invented value —
 * and anything that does NOT normalize is left byte-identical so nothing the
 * owner said is ever lost.
 */
export function canonicalizeContactFacts<T extends { instagram?: string; telegram?: string }>(
  facts: T,
): T {
  const out = { ...facts };
  if (typeof out.instagram === "string") {
    out.instagram = normalizeIgHandle(out.instagram) ?? out.instagram;
  }
  if (typeof out.telegram === "string") {
    out.telegram = normalizeTelegramUsername(out.telegram) ?? out.telegram;
  }
  return out;
}
