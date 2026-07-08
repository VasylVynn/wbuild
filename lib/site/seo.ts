import type { Tenant } from "@/lib/tenant/types";
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

/** Meta description: the tenant tagline, else the first ~150 chars of the
 *  freeform "about" fact. Undefined when neither exists (no invented copy). */
export function siteDescription(tenant: Tenant): string | undefined {
  if (tenant.brand.tagline) return tenant.brand.tagline;
  const about = (tenant.facts as { about?: unknown }).about;
  if (typeof about !== "string" || !about.trim()) return undefined;
  const trimmed = about.trim();
  return trimmed.length > 150 ? `${trimmed.slice(0, 150).trimEnd()}…` : trimmed;
}

/** Schema.org LocalBusiness for the HOME page of a published tenant (§10.3).
 *  Emits ONLY fields present in facts/brand — no hallucinated data — and omits
 *  openingHours (freeform Ukrainian text is not schema-valid). Returns a string
 *  safe to drop into a <script> tag: `<` is escaped so no `</script>` breakout. */
export function localBusinessJsonLd(tenant: Tenant, image?: string): string {
  const facts = tenant.facts as {
    businessName?: string;
    city?: string;
    phone?: string;
    address?: string;
    about?: string;
  };

  const name = tenant.brand.businessName || facts.businessName;
  const telephone = facts.phone ?? tenant.footer.phone;
  const streetAddress = facts.address ?? tenant.footer.address;
  const addressLocality = facts.city;
  const description = siteDescription(tenant);

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

  return JSON.stringify(data).replace(/</g, "\\u003c");
}
