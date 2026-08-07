/**
 * Same-origin redirect guard for the `next` handoff parameter (login, OAuth
 * callback, signup-confirmation email). ONE copy — both the "use server"
 * actions file and the callback route import it (plain module, so importing
 * from a "use server" file is not needed and the two copies can never drift).
 *
 * Hardening (security review): the WHATWG URL parser STRIPS ASCII tab/CR/LF
 * before parsing, so `new URL("/\t/evil.com", base)` resolves to
 * `https://evil.com/` — a prefix check alone is an open redirect. We reject
 * every C0 control character outright, then re-validate BY CONSTRUCTION
 * against a sentinel origin and return only the parsed path+query+hash.
 */
export function safeNext(next?: string | null): string {
  if (!next) return "/sites";
  // Control chars (TAB/CR/LF and friends) are removed by URL parsing — any
  // occurrence means the string cannot be trusted as a same-origin path.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(next)) return "/sites";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/sites";
  try {
    const u = new URL(next, "https://x.invalid");
    if (u.origin !== "https://x.invalid") return "/sites";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/sites";
  }
}
