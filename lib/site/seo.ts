import type { Tenant, PageSeo } from "@/lib/tenant/types";
import type { StoredBlock } from "@/lib/blocks/schema";

/**
 * Shared SEO primitives (§10). Every absolute URL is built from the tenant's
 * canonicalHostname (§2.4) — NEVER the request host — so canonical, og:url,
 * sitemap and JSON-LD all agree on one host regardless of how the page was hit.
 */

// Used when a tenant somehow has no theme color — favicon must still render.
const NEUTRAL_PRIMARY = "#334155";

/** Absolute canonical URL for a tenant page. Home ("") → bare origin with NO
 *  trailing slash (§10.1); other slugs → origin + "/" + slug. */
export function canonicalUrl(tenant: Pick<Tenant, "canonicalHostname">, slug: string): string {
  const origin = `https://${tenant.canonicalHostname}`;
  return slug ? `${origin}/${slug}` : origin;
}

/** Escape the five XML predefined entities — for sitemap <loc> and SVG text. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** First usable image across a page's visible blocks, in document order so the
 *  hero (normally first) wins, then services/gallery/switchback. Feeds
 *  og:image, the twitter card variant and JSON-LD `image` (§10.3). */
export function firstImageFromBlocks(blocks: StoredBlock[]): string | undefined {
  for (const block of blocks) {
    if (block.hidden) continue;
    const url = imageFromBlock(block);
    if (url) return url;
  }
  return undefined;
}

function imageFromBlock(block: StoredBlock): string | undefined {
  switch (block.type) {
    case "hero":
      return block.props.imageUrl || undefined;
    case "services":
      return block.props.items.find((i) => i.imageUrl)?.imageUrl || undefined;
    case "gallery":
      return block.props.images[0]?.url || undefined;
    case "switchback":
      return block.props.items[0]?.imageUrl || undefined;
    default:
      return undefined;
  }
}

/** Per-tenant favicon with zero infra: a rounded square in the theme primary
 *  color bearing the first letter of the business name, inlined as a
 *  data: URI on `icons.icon` (§10). Falls back to a neutral color if theme is
 *  absent. */
export function faviconDataUri(
  businessName: string,
  primary?: string,
  primaryForeground?: string,
): string {
  const bg = primary ?? NEUTRAL_PRIMARY;
  const fg = primaryForeground ?? "#ffffff";
  const letter = escapeXml((businessName.trim().charAt(0) || "•").toUpperCase());
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="${bg}"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" ` +
    `font-family="system-ui,-apple-system,Segoe UI,sans-serif" ` +
    `font-size="38" font-weight="700" fill="${fg}">${letter}</text>` +
    `</svg>`;
  // encodeURIComponent (not base64) keeps the markup human-readable in the head.
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Meta description: the page's model-written SEO description (wave D1) when
 *  present, else the tenant tagline, else the first ~150 chars of the freeform
 *  "about" fact. Undefined when none exists (no invented copy). */
export function siteDescription(tenant: Tenant, seo?: PageSeo): string | undefined {
  const fromSeo = seo?.description?.trim();
  if (fromSeo) return fromSeo;
  if (tenant.brand.tagline) return tenant.brand.tagline;
  const about = (tenant.facts as { about?: unknown }).about;
  if (typeof about !== "string" || !about.trim()) return undefined;
  const trimmed = about.trim();
  return trimmed.length > 150 ? `${trimmed.slice(0, 150).trimEnd()}…` : trimmed;
}

// ── openingHours parsing (wave D2) ──────────────────────────────────────────
// The `hours` fact is freeform Ukrainian («Пн–Пт 9:00–18:00, Сб 10:00–15:00»).
// Schema.org wants "Mo-Fr 09:00-18:00". We convert ONLY what parses with
// confidence and silently skip the rest («за записом» → nothing) — never an
// invented schedule (§4.4 grounding spirit).

const SCHEMA_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

// Order matters: longer full names first so «пʼятниця» is not read as «пт».
// Abbreviations need letter-boundary lookarounds (\b is ASCII-only in JS):
// «вт» must not match inside «завтра».
const B = "(?<![а-яіїєґ])";
const E = "(?![а-яіїєґ])";
const DAY_WORDS: [RegExp, number][] = [
  [/понеділок/g, 0],
  [/вівторок/g, 1],
  [/серед[аиу]/g, 2],
  [/четвер/g, 3],
  [/п[’'ʼ]?ятниц[яюі]/g, 4],
  [/субот[аиу]/g, 5],
  [/неділ[яюі]/g, 6],
  ...(["пн", "вт", "ср", "чт", "пт", "сб", "нд"].map(
    (abbr, day) => [new RegExp(`${B}${abbr}${E}`, "g"), day] as [RegExp, number],
  )),
];

function fmt(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Time range in a segment: «9:00–18:00», «9-18», «з 9 до 18». Null when
 *  absent/implausible. Day words must be stripped BEFORE calling (their
 *  dashes would otherwise sit next to the digits). */
function parseTimeRange(seg: string): string | null {
  if (/цілодобово|24\s*\/\s*7/.test(seg)) return "00:00-23:59";
  const m = seg.match(/(?:з\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:-|–|—|до)\s*(\d{1,2})(?::(\d{2}))?/);
  if (!m) return null;
  const h1 = Number(m[1]);
  const m1 = Number(m[2] ?? "0");
  let h2 = Number(m[3]);
  let m2 = Number(m[4] ?? "0");
  if (h2 === 24 && m2 === 0) (h2 = 23), (m2 = 59);
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
  if (h1 * 60 + m1 >= h2 * 60 + m2) return null;
  return `${fmt(h1, m1)}-${fmt(h2, m2)}`;
}

/**
 * Freeform Ukrainian hours → schema.org openingHours strings
 * ("Mo-Fr 09:00-18:00"). Comma/semicolon-separated segments parse
 * independently; a segment yields output only when BOTH a day spec and a time
 * range are recognized (except «цілодобово»/«24/7», which implies Mo-Su).
 * A comma-separated day list («Пн, Ср, Пт 9-18») splits into day-only
 * segments — those PEND until a time-carrying segment closes the list; only
 * PURE day segments pend, so «Нд — вихідний» can never inherit a later time.
 * Unparseable input → []  (the property is then omitted entirely) — an
 * incomplete or wrong schedule is worse than none (codex review, wave D).
 */
export function parseOpeningHours(hours: string): string[] {
  const out: string[] = [];
  let pending: number[] = [];
  for (const rawSeg of hours.toLowerCase().split(/[,;]/)) {
    const seg = rawSeg.trim();
    if (!seg) continue;

    // Collect day mentions (position + length + index) while blanking them out
    // so the time regex never sees the dash of «пн–пт».
    let rest = seg;
    const found: { pos: number; len: number; day: number }[] = [];
    for (const [re, day] of DAY_WORDS) {
      rest = rest.replace(re, (match, offset: number) => {
        found.push({ pos: offset, len: match.length, day });
        return " ".repeat(match.length);
      });
    }
    found.sort((a, b) => a.pos - b.pos);

    let days: string | null = null;
    if (/щодня|кожного дня|без вихідних|24\s*\/\s*7|цілодобово/.test(seg) && found.length === 0) {
      days = "Mo-Su";
    } else if (/будні|робочі дні/.test(seg) && found.length === 0) {
      days = "Mo-Fr";
    } else if (found.length === 2) {
      // Dash between the two days = a RANGE («пн–пт»); «сб і нд» is a list.
      const between = seg.slice(found[0].pos + found[0].len, found[1].pos);
      if (/^[\s-–—]*$/.test(between) && /[-–—]/.test(between)) {
        if (found[0].day < found[1].day) {
          days = `${SCHEMA_DAYS[found[0].day]}-${SCHEMA_DAYS[found[1].day]}`;
        } else {
          // Wrap-around range («Пт–Пн») — emitting only its endpoints would be
          // WRONG (weekend silently dropped). Unparseable → skip the segment.
          pending = [];
          continue;
        }
      }
    }

    const time = parseTimeRange(rest);
    if (!time) {
      // No time in this segment. A PURE day segment (nothing but day names and
      // connectors after blanking) is a list item awaiting its time («Пн,»);
      // anything else («Нд — вихідний», «за записом») hard-resets the list.
      const leftovers = rest.replace(/\b(і|та)\b/g, " ");
      if (found.length > 0 && !days && /^[\s-–—]*$/.test(leftovers)) {
        pending.push(...found.map((f) => f.day));
      } else {
        pending = [];
      }
      continue;
    }

    if (days) {
      // Range/щодня/будні: pending pure days ride along («Пн, Ср–Пт 9-18»).
      for (const d of pending) out.push(`${SCHEMA_DAYS[d]} ${time}`);
      out.push(`${days} ${time}`);
    } else {
      // Day list — the segment's own days plus any pending («Пн, Ср, Пт 9-18»).
      const list = [...pending, ...found.map((f) => f.day)];
      for (const d of list) out.push(`${SCHEMA_DAYS[d]} ${time}`);
    }
    pending = [];
  }
  return out;
}

/** Price range from the services' freeform prices («від 500 грн», «1 200 грн»):
 *  min–max over the CURRENCY-anchored numbers. Prices routinely embed other
 *  digits («15 троянд — 1200 грн», «2 год — 800 грн»), so when a currency
 *  token is present only number(-range)s adjacent to it count; a string with
 *  no currency at all («400») is taken as a bare price. Nothing found →
 *  undefined (omit). (Codex review, wave D.) */
function priceRangeFromServices(services?: { price?: string }[]): string | undefined {
  const nums: number[] = [];
  let hasFrom = false;
  const collect = (chunk: string) => {
    for (const m of chunk.matchAll(/\d[\d\s\u00a0]*\d|\d/g)) {
      const n = Number(m[0].replace(/[\s\u00a0]/g, ""));
      if (Number.isFinite(n) && n > 0) nums.push(n);
    }
  };
  for (const s of services ?? []) {
    if (!s.price) continue;
    if (/від/i.test(s.price)) hasFrom = true;
    if (/грн|₴|uah/i.test(s.price)) {
      // Only the number (or number-range) adjacent to a currency token counts
      // — quantities and durations in the same string never do. Both orders:
      // «450 грн» and «₴450». («₴500 грн» double-counts — harmless for min/max.)
      for (const m of s.price.matchAll(
        /(\d[\d\s\u00a0]*(?:[-–—]\s*\d[\d\s\u00a0]*)?)(?:грн|₴|uah)/gi,
      )) {
        collect(m[1]);
      }
      for (const m of s.price.matchAll(
        /(?:грн|₴|uah)\s*(\d[\d\s\u00a0]*(?:[-–—]\s*\d[\d\s\u00a0]*)?)/gi,
      )) {
        collect(m[1]);
      }
    } else {
      collect(s.price);
    }
  }
  if (nums.length === 0) return undefined;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return hasFrom ? `від ${min} грн` : `${min} грн`;
  return `${min}–${max} грн`;
}

/** sameAs: absolute http(s) social links from the facts, plus the instagram
 *  fact (wave E adds it; read defensively — full URL or bare handle). */
function sameAsLinks(facts: {
  socials?: { href?: string }[];
  instagram?: unknown;
}): string[] {
  const out: string[] = [];
  const push = (u: string) => {
    if (!out.includes(u)) out.push(u);
  };
  for (const s of facts.socials ?? []) {
    const href = (s.href ?? "").trim();
    if (/^https?:\/\//i.test(href)) push(href);
  }
  if (typeof facts.instagram === "string" && facts.instagram.trim()) {
    const v = facts.instagram.trim();
    if (/^https?:\/\//i.test(v)) push(v);
    else {
      const handle = v.replace(/^@/, "");
      if (/^[a-z0-9._]{1,30}$/i.test(handle)) push(`https://instagram.com/${handle}`);
    }
  }
  return out;
}

/** Schema.org LocalBusiness for the HOME page of a published tenant (§10.3).
 *  Emits ONLY fields present in facts/brand — no hallucinated data. Wave D2:
 *  openingHours (when the freeform hours parse confidently), priceRange (from
 *  the services' prices) and sameAs (social links) join the block. Returns a
 *  string safe to drop into a <script> tag: `<` is escaped so no `</script>`
 *  breakout. */
export function localBusinessJsonLd(tenant: Tenant, image?: string, seo?: PageSeo): string {
  const facts = tenant.facts as {
    businessName?: string;
    city?: string;
    phone?: string;
    address?: string;
    about?: string;
    hours?: string;
    services?: { price?: string }[];
    socials?: { href?: string }[];
    instagram?: unknown;
  };

  const name = tenant.brand.businessName || facts.businessName;
  const telephone = facts.phone ?? tenant.footer.phone;
  const streetAddress = facts.address ?? tenant.footer.address;
  const addressLocality = facts.city;
  const description = siteDescription(tenant, seo);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    url: canonicalUrl(tenant, ""),
  };
  if (name) data.name = name;
  if (telephone) data.telephone = telephone;
  if (image) data.image = image;
  if (description) data.description = description;
  if (streetAddress || addressLocality) {
    const address: Record<string, unknown> = { "@type": "PostalAddress", addressCountry: "UA" };
    if (streetAddress) address.streetAddress = streetAddress;
    if (addressLocality) address.addressLocality = addressLocality;
    data.address = address;
  }

  const hoursText = facts.hours ?? tenant.footer.hours;
  if (hoursText) {
    const openingHours = parseOpeningHours(hoursText);
    if (openingHours.length) {
      data.openingHours = openingHours.length === 1 ? openingHours[0] : openingHours;
    }
  }
  const priceRange = priceRangeFromServices(facts.services);
  if (priceRange) data.priceRange = priceRange;
  const sameAs = sameAsLinks(facts);
  if (sameAs.length) data.sameAs = sameAs;

  return JSON.stringify(data).replace(/</g, "\\u003c");
}
