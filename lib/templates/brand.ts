import type { StoredBlock } from "@/lib/blocks/schema";
import type { SiteTemplate, TemplateBrand } from "@/lib/templates/registry";
import type { BrandLogoRecord } from "@/lib/tenant/types";
import { isStorageUrl } from "@/lib/media/media";

/**
 * Build the TemplateBrand (Nav/Footer identity) for a template site from the
 * business name + the page's blocks — the same rules the public renderer uses
 * (app/s/[host]): two-tone name split, nav from the sections actually present,
 * real contacts from the grounded contacts block.
 */

// Sections that are not DESTINATIONS at all — they never appear in the nav nor
// in the footer index.
//   hero          — the nav already sits on top of it;
//   cta / banner  — a CTA is a target, not a destination;
//   lead_form     — that is exactly what the nav's own CTA points at;
//   contacts      — the sticky CTA and the footer both serve that intent.
const LINK_SKIP = new Set(["hero", "stats", "cta", "banner", "lead_form", "contacts"]);

// Destinations that exist, but never earn one of the nav's few slots:
// supporting texture. Nobody arrives looking for the marquee, and «Instagram»
// in the nav reads as a link off the site (owner audit 2026-08-10). They stay
// in `allSectionLinks`, i.e. in the footer's «Розділи» index.
const NAV_SKIP = new Set(["map", "instagram_cta", "press", "values"]);

/**
 * NAV BUDGET (owner audit 2026-08-10). Nine links pushed «Залишити заявку» onto
 * a second row at 1440px — a wrapped CTA is a broken funnel (invariant 8). The
 * bar is one row per band at every width, so the LINK COUNT is what has to give,
 * and it gives by PRIORITY, not by hiding behind a menu: a hamburger for
 * same-page anchors is a heavier affordance than simply not listing the
 * sixth-most-wanted section.
 *
 * Rank = how likely a visitor is to be hunting for that section. Everything
 * unranked sorts after the named ones (a new section is never assumed
 * important). The kept links are then RE-SORTED into document order — a nav
 * whose order disagrees with the page's own order is its own kind of broken.
 * Overflow is dropped, not menued: the section is still reachable by scrolling
 * and `allSectionLinks` still indexes it in the footer's «Розділи» column.
 *
 * FOUR, not five: five plus a wordmark plus the CTA measured 102px of silently
 * hidden overflow at 768px. The cap applies to the WIREFRAME only — the eleven
 * legacy templates render `navLinks` in their nav AND their footer and are
 * already-published sites, so re-budgeting them without regeneration would
 * silently drop links from live pages.
 */
const NAV_RANK = ["services", "gallery", "team", "story", "testimonials", "process", "faq"];
const NAV_MAX = 4;
const BUDGETED_TEMPLATES = new Set(["salonwire"]);

function navRank(section: string): number {
  const i = NAV_RANK.indexOf(section);
  return i === -1 ? NAV_RANK.length : i;
}

/**
 * The tenant's logo record as stored on `tenants.brand`, declared ONCE on the
 * tenant model (lib/tenant/types.ts) and re-exported here, where it is read.
 * Structurally typed so `tenant.brand` can be handed over WHOLE: the render
 * path never picks a URL out of it by hand, which is how the nav and the footer
 * stay in step, and a new field there needs no rewiring.
 */
export type BrandLogoSource = BrandLogoRecord;

/** The chrome surface the mark is drawn on: wire.css `--wire-surface: #fafafa`
 *  (`.wire-nav`), in CIE L*. The footer's background is the generated sheet's,
 *  so the nav is the one surface we can name deterministically — and the one an
 *  invisible mark is most often reported on. */
const CHROME_SURFACE_L = 98;
/** Closer than this and the mark and the surface are the same tone: the artwork
 *  is there and nobody can see it. */
const INK_SURFACE_MIN_DELTA_L = 20;
/** A NEUTRAL chip, deliberately not the original canvas colour — the point of
 *  the adaptation was to remove that slab, not to repaint it. This only ever
 *  appears behind a mark measured to be as pale as the chrome it sits on. */
const NEUTRAL_PLATE = "#1c1c1c";

/**
 * THE display-logo contract (owner audit L1): every surface that shows the
 * brand mark resolves through here — public nav and footer, editor preview.
 * Adapted when we have one, the owner's original otherwise, and NEITHER unless
 * it lives in our own bucket (invariant 1: a foreign URL can never be a site's
 * logo, whatever a tampered row says).
 *
 * The pairing is the part that is easy to get wrong. A plate belongs to the
 * ASSET IT WAS MEASURED FROM, not to the tenant: an adapted mark is transparent
 * by construction, so carrying the original's plate across would paint the
 * original's opaque canvas colour behind it — the black slab straight back,
 * behind a mark that no longer needs any backdrop at all. The write side
 * already declines to store both; this is the belt, and it is what keeps the
 * two placements honest if a row ever carries both.
 *
 * What replaces the plate for an adapted mark is a MEASUREMENT of the mark
 * itself. Masking a canvas away removes the contrast that came with it: the
 * pale badge that read perfectly on its black square is a pale shape on a
 * near-white nav once the square is gone — a different failure, not a fix. So
 * when `logoInkL` says the surviving ink is the same tone as the chrome surface,
 * the mark keeps a chip; but a NEUTRAL one, never the canvas colour we removed.
 *
 * Fail-open in both directions: no adapted asset → the original plus whatever
 * plate was measured for it; no measurement → no chip, which is always safe.
 */
export function resolveDisplayLogo(src?: BrandLogoSource): {
  logoUrl?: string;
  logoPlate?: string;
} {
  if (!src) return {};
  if (isStorageUrl(src.logoAdaptedUrl)) {
    const inkL = src.logoInkL;
    const vanishes =
      typeof inkL === "number" && Math.abs(CHROME_SURFACE_L - inkL) < INK_SURFACE_MIN_DELTA_L;
    return { logoUrl: src.logoAdaptedUrl, ...(vanishes ? { logoPlate: NEUTRAL_PLATE } : {}) };
  }
  if (!isStorageUrl(src.logoUrl)) return {};
  return { logoUrl: src.logoUrl, ...(src.logoPlate ? { logoPlate: src.logoPlate } : {}) };
}

export function buildTemplateBrand(
  businessName: string,
  blocks: StoredBlock[],
  template: SiteTemplate,
  /** The tenant's logo record — pass `tenant.brand` whole and let
   *  `resolveDisplayLogo` choose. ONE door: the bare-string overload used to
   *  bypass the storage-URL check invariant 1 exists for, and by the end it was
   *  keeping nothing but two fixture lines compiling. */
  logo?: BrandLogoSource,
  /** The stylesheet the model wrote for this site, stored on its page content
   *  next to the blocks it was written for. */
  wireCss?: string,
  /** The design brief stored on the SAME page content copy as `wireCss`
   *  (published vs draft) — the wrapper renders fonts/motion from it. */
  designSpec?: TemplateBrand["designSpec"],
): TemplateBrand {
  const display = resolveDisplayLogo(logo);
  // Nav real estate is precious: a name like «DIVA | салон краси Самбір»
  // renders as just «DIVA» — the first segment before a separator. The full
  // name still lives everywhere else (SEO, footer copyright, facts).
  const compact = businessName.split(/\s*[|—–·]\s*/)[0].trim() || businessName.trim();
  const name = compact;
  const words = name.split(/\s+/).filter(Boolean);

  const seen = new Set<string>();
  const candidates: { href: string; label: string; order: number; rank: number; section: string }[] = [];
  for (const b of blocks) {
    const s = b.section;
    if (!s || b.hidden || LINK_SKIP.has(s) || seen.has(s)) continue;
    const def = template.sections[s];
    if (!def?.label) continue;
    seen.add(s);
    candidates.push({
      href: `#${s}`,
      label: def.navLabel ?? def.label,
      order: candidates.length,
      rank: navRank(s),
      section: s,
    });
  }
  // Every destination, document order — what the wireframe footer indexes.
  const allSectionLinks = candidates.map(({ href, label }) => ({ href, label }));
  // The budget (and the texture-section skip that goes with it) is the
  // wireframe's; a legacy template keeps exactly the list it always got.
  const navLinks = (
    BUDGETED_TEMPLATES.has(template.id)
      ? candidates
          .filter((c) => !NAV_SKIP.has(c.section))
          // Rank first (ties keep document order — the sort is stable in ES2019+)…
          .sort((a, b) => a.rank - b.rank || a.order - b.order)
          .slice(0, NAV_MAX)
          // …then back to the order the visitor will actually meet them in.
          .sort((a, b) => a.order - b.order)
      : candidates
  ).map(({ href, label }) => ({ href, label }));

  const contact = blocks.find((b) => b.type === "contacts")?.props as
    | { phone?: string; address?: string; hours?: string; email?: string; telegram?: string; viber?: string; instagram?: string }
    | undefined;

  return {
    brandName: words.length > 1 ? words.slice(0, -1).join(" ") + " " : name,
    brandAccent: words.length > 1 ? words[words.length - 1] : "",
    ...(display.logoUrl ? { logoUrl: display.logoUrl } : {}),
    ...(display.logoPlate ? { logoPlate: display.logoPlate } : {}),
    navLinks,
    allSectionLinks,
    ctaHref: "#lead_form",
    ...(wireCss ? { wireCss } : {}),
    ...(designSpec ? { designSpec } : {}),
    contact,
  };
}
