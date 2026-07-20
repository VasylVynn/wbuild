import type { StoredBlock } from "@/lib/blocks/schema";
import type { SiteTemplate, TemplateBrand } from "@/lib/templates/registry";

/**
 * Build the TemplateBrand (Nav/Footer identity) for a template site from the
 * business name + the page's blocks — the same rules the public renderer uses
 * (app/s/[host]): two-tone name split, nav from the sections actually present,
 * real contacts from the grounded contacts block.
 */

const NAV_SKIP = new Set(["hero", "stats", "cta", "lead_form", "contacts"]);

export function buildTemplateBrand(
  businessName: string,
  blocks: StoredBlock[],
  template: SiteTemplate,
  /** Display logo (storage URL) — the caller resolves original vs adapted. */
  logoUrl?: string,
  /** DNA-2c: seeded template data-theme from the tenant's DNA. */
  dnaTheme?: string,
): TemplateBrand {
  const name = businessName.trim();
  const words = name.split(/\s+/).filter(Boolean);

  const seen = new Set<string>();
  const navLinks: { href: string; label: string }[] = [];
  for (const b of blocks) {
    const s = b.section;
    if (!s || b.hidden || NAV_SKIP.has(s) || seen.has(s)) continue;
    const label = template.sections[s]?.label;
    if (!label) continue;
    seen.add(s);
    navLinks.push({ href: `#${s}`, label });
  }

  const contact = blocks.find((b) => b.type === "contacts")?.props as
    | { phone?: string; address?: string; hours?: string; email?: string; telegram?: string; viber?: string; instagram?: string }
    | undefined;

  return {
    brandName: words.length > 1 ? words.slice(0, -1).join(" ") + " " : name,
    brandAccent: words.length > 1 ? words[words.length - 1] : "",
    ...(logoUrl ? { logoUrl } : {}),
    navLinks,
    ctaHref: "#lead_form",
    ...(dnaTheme ? { dnaTheme } : {}),
    contact,
  };
}
