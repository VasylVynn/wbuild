import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Local replacement for Anthropic's SERVER web_fetch tool (the OpenAI
 * migration has no server-side fetch): the onboard agent may read a URL the
 * owner pasted into the conversation. Because WE now execute the fetch, WE
 * own the SSRF surface — hence the guards, none of which the server tool
 * needed:
 *  - http/https only, no credentials in the URL;
 *  - the resolved address must be public (no loopback/private/link-local/
 *    metadata ranges) — checked on the RESOLVED IPs, not the hostname;
 *  - redirects are followed manually (≤3) so every hop is re-checked;
 *  - 8s total, 500KB cap, text-ish content types only.
 * Returns readable text (tags stripped) — the model wants prose, not markup.
 */

const MAX_BYTES = 500_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;

function ipIsPrivate(ip: string): boolean {
  if (ip.includes(":")) {
    const low = ip.toLowerCase();
    return (
      low === "::1" ||
      low.startsWith("fe80") ||
      low.startsWith("fc") ||
      low.startsWith("fd") ||
      low.startsWith("::ffff:127.") ||
      low.startsWith("::ffff:10.") ||
      low.startsWith("::ffff:192.168.")
    );
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) || // link-local + cloud metadata
    a >= 224
  );
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.username || url.password) throw new Error("credentials in URL");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not http(s)");
  const host = url.hostname;
  if (isIP(host)) {
    if (ipIsPrivate(host)) throw new Error("private address");
    return;
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("private hostname");
  }
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => ipIsPrivate(a.address))) {
    throw new Error("private address");
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Fetch a conversation URL for the agent. Returns readable text or throws. */
export async function fetchUrlForAgent(rawUrl: string): Promise<string> {
  let url = new URL(rawUrl);
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: deadline,
      headers: { "user-agent": "Mozilla/5.0 (compatible; 3minsite-agent)" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`redirect without location (${res.status})`);
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ctype = res.headers.get("content-type") ?? "";
    if (!/text|json|xml|html/i.test(ctype)) throw new Error(`unsupported type: ${ctype}`);
    const reader = res.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(value);
      if (total >= MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const text = buf.toString("utf-8");
    return /html/i.test(ctype) ? htmlToText(text).slice(0, 60_000) : text.slice(0, 60_000);
  }
  throw new Error("too many redirects");
}
