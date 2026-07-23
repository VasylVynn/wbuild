/**
 * Text safety for the Anthropic request body.
 *
 * Our prompts/messages carry scraped Instagram captions, bios and photo OCR —
 * emoji-heavy text. Truncating those with `String.slice(0, n)` cuts by UTF-16
 * code unit, so a boundary that lands INSIDE a surrogate pair (an emoji is two
 * code units) leaves a LONE surrogate. `JSON.stringify` then emits an unpaired
 * `\uD83D`, and the Anthropic API rejects the whole request with a 400:
 *   "The request body is not valid JSON: no low surrogate in string".
 * A single such fragment anywhere in a ~30KB body kills the turn (seen in prod).
 *
 * `stripLoneSurrogates` removes any unpaired surrogate (a high surrogate not
 * followed by a low one, or a low not preceded by a high). `safeSlice`
 * truncates without ever splitting a pair — use it in place of `.slice(0, n)`
 * on model-bound text.
 */

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Drop unpaired UTF-16 surrogates so the string serializes to valid JSON. */
export function stripLoneSurrogates(s: string): string {
  return s.replace(LONE_SURROGATE, "");
}

/** `s.slice(0, max)` that never cuts inside a surrogate pair. */
export function safeSlice(s: string, max: number): string {
  if (s.length <= max || max <= 0) return s.length <= max ? s : s.slice(0, Math.max(0, max));
  // If index max-1 is a high surrogate, its low half sits at index max and
  // would be cut off — step back one so the whole emoji is dropped, not split.
  const code = s.charCodeAt(max - 1);
  const end = code >= 0xd800 && code <= 0xdbff ? max - 1 : max;
  return s.slice(0, end);
}

/**
 * Sanitize the `messages` array sent to Anthropic: strip lone surrogates from
 * every USER-authored string (message text + tool_result text). Assistant
 * turns are left BYTE-for-BYTE untouched — thinking/tool_use blocks must be
 * replayed exactly or the API rejects them; model output never carries lone
 * surrogates anyway.
 */
export function sanitizeMessages<T extends { role: string; content: unknown }>(messages: T[]): T[] {
  return messages.map((m) => {
    if (m.role === "assistant") return m;
    if (typeof m.content === "string") {
      return { ...m, content: stripLoneSurrogates(m.content) };
    }
    if (Array.isArray(m.content)) {
      const content = m.content.map((block) => {
        if (block && typeof block === "object") {
          const b = block as Record<string, unknown>;
          if (typeof b.content === "string") return { ...b, content: stripLoneSurrogates(b.content) };
          if (typeof b.text === "string") return { ...b, text: stripLoneSurrogates(b.text) };
        }
        return block;
      });
      return { ...m, content };
    }
    return m;
  });
}
