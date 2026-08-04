import { createLogger } from "@/lib/log";
import { ROOT_DOMAIN, stripPort } from "@/lib/config";

/**
 * Domain availability via RDAP (spec 2026-08-05 §4). Registration itself is
 * manual ops — this only answers "is the name free?" well enough to let an owner
 * pick one in the funnel.
 *
 * Endpoints (verified live 2026-08-05, IANA bootstrap https://data.iana.org/rdap/dns.json):
 *   - `.ua` and every second level under it (com.ua, kyiv.ua, …) →
 *     https://rdap.hostmaster.ua/domain/<domain>
 *     IANA lists the base as `https://rdap.hostmaster.ua/`, so the path is
 *     `/domain/<name>` — NOT `/rdap/domain/<name>` (that shape answers 400).
 *     Reglament: https://www.hostmaster.ua/rdap/
 *   - everything else → https://rdap.org/domain/<domain>, the community
 *     bootstrap proxy that 302s to the authoritative registry server.
 *
 * Answers are advisory: "unknown" is a first-class result and the UI must say
 * «не вдалося перевірити» rather than guess. The one thing this must never do is
 * claim a taken name is free, so every ambiguous signal degrades to "unknown".
 */

const log = createLogger("rdap");

export type DomainAvailability = "available" | "taken" | "unknown";

const RDAP_TIMEOUT_MS = 5000;
const BOOTSTRAP_HOST = "rdap.org";

/**
 * Hosts an owner must never "buy": ours. ROOT_DOMAIN covers the current
 * deployment (`lvh.me:3000` locally, `wizz-app.net` in prod); the literals cover
 * the rest of the brand migration (docs say Вітрина/vitryna, prod runs
 * wizz-app.net, target is 3minsite) so the check holds whichever one is live.
 */
const PLATFORM_DOMAINS = [
  "wizz-app.net",
  "3minsite.com",
  "vitryna.com.ua",
  "lvh.me",
  "localhost",
];

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_RE = /^[a-z]{2,63}$/;

/**
 * User input → a bare, lowercase, ASCII hostname, or null when it can't be one.
 * Accepts what people actually paste ("https://Мій-Сайт.com.ua/", "www.foo.ua ")
 * and rejects IDN outright: we register through a human at a registrar, and
 * punycode round-tripping is a footgun we don't need for the demand test.
 */
export function normalizeDomain(input: string): string | null {
  if (typeof input !== "string") return null;

  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  d = d.split(/[/?#]/)[0] ?? ""; // path / query / fragment
  d = d.split("@").pop() ?? ""; // userinfo, if someone pasted a URL with one
  d = d.split(":")[0] ?? ""; // port
  d = d.replace(/^www\./, "");
  d = d.replace(/\.$/, ""); // trailing root dot

  if (!d || d.length > 253) return null;

  const labels = d.split(".");
  if (labels.length < 2) return null; // a TLD alone is not a domain
  if (!labels.every((l) => LABEL_RE.test(l))) return null;
  if (!TLD_RE.test(labels[labels.length - 1])) return null;

  const blocked = [...PLATFORM_DOMAINS, stripPort(ROOT_DOMAIN)];
  if (blocked.some((b) => d === b || d.endsWith(`.${b}`))) return null;

  return d;
}

/** `.ua` is served by the national registry; everything else via the bootstrap. */
function rdapUrl(domain: string): string {
  return domain.endsWith(".ua")
    ? `https://rdap.hostmaster.ua/domain/${domain}`
    : `https://${BOOTSTRAP_HOST}/domain/${domain}`;
}

/**
 * HTTP 200 = registered, 404 = free, anything else = we don't know.
 *
 * The one trap: rdap.org answers 404 ITSELF, without redirecting, when the TLD
 * has no RDAP service at all (`foo.zzzznotatld`). Read naively that says "free"
 * for a TLD that cannot be bought. A genuine "not registered" always arrives
 * from the registry AFTER a 302, so a 404 still sitting on rdap.org is "unknown".
 *
 * Known blind spot: privately delegated `.ua` sub-zones may hold registrations
 * hostmaster doesn't see, so a name can read "available" and still be taken.
 * Manual registration catches it — the operator is a human at a registrar.
 */
export async function checkAvailability(domain: string): Promise<DomainAvailability> {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    log.warn("availability asked for an invalid domain", { domain });
    return "unknown";
  }

  const url = rdapUrl(normalized);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
      cache: "no-store",
    });

    if (res.status === 200) return "taken";

    if (res.status === 404) {
      const bounced =
        res.redirected || (res.url ? new URL(res.url).hostname !== BOOTSTRAP_HOST : false);
      if (url.includes(BOOTSTRAP_HOST) && !bounced) {
        log.warn("no RDAP service for this TLD", { domain: normalized });
        return "unknown";
      }
      return "available";
    }

    log.warn("unexpected RDAP status", { domain: normalized, status: res.status });
    return "unknown";
  } catch (e) {
    log.warn("RDAP lookup failed", { domain: normalized, url, error: e });
    return "unknown";
  }
}
