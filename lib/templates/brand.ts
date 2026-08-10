import type { StoredBlock } from "@/lib/blocks/schema";
import type { SiteTemplate, TemplateBrand } from "@/lib/templates/registry";

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

export function buildTemplateBrand(
  businessName: string,
  blocks: StoredBlock[],
  template: SiteTemplate,
  /** Display logo (storage URL) — the caller resolves original vs adapted. */
  logoUrl?: string,
  /** The stylesheet the model wrote for this site, stored on its page content
   *  next to the blocks it was written for. */
  wireCss?: string,
  /** The design brief stored on the SAME page content copy as `wireCss`
   *  (published vs draft) — the wrapper renders fonts/motion from it. */
  designSpec?: TemplateBrand["designSpec"],
  /** Opaque-logo backdrop measured at import (`"none"` | hex) — see
   *  TemplateBrand.logoPlate. Absent → the mark renders with no plate, which is
   *  always safe: a transparent asset needs none and an opaque one merely keeps
   *  today's look. */
  logoPlate?: string,
): TemplateBrand {
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
    ...(logoUrl ? { logoUrl } : {}),
    ...(logoPlate ? { logoPlate } : {}),
    navLinks,
    allSectionLinks,
    ctaHref: "#lead_form",
    ...(wireCss ? { wireCss } : {}),
    ...(designSpec ? { designSpec } : {}),
    contact,
  };
}
