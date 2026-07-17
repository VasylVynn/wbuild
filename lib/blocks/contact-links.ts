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
 * https://t.me/... link. `raw` is either a Telegram username (with or
 * without a leading @) or a phone number (any punctuation, UA-normalized).
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
  const username = trimmed.replace(/^@+/, "");
  if (!username) return null;
  return `https://t.me/${username}`;
}
