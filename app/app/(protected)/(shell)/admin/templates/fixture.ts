import type { StoredBlock } from "@/lib/blocks/schema";
import type { SiteTemplate } from "@/lib/templates/registry";
import { fixtureContent } from "../packs/fixture";

/**
 * Fixture blocks for a template preview. Iterates the template's OWN sections (in
 * canonical `order`) rather than the fixture types, so EVERY section renders —
 * including several that share one block type (studio: features/howitworks/pricing
 * all read `services`). Each section is fed the shared fixture content for its
 * block type and tagged with the section id; PageRenderer(templateId) then routes
 * each to its section component. Sections whose block type has no fixture are
 * skipped. This is a preview only — real generation caps blocks by maxPerPage.
 */
export function fixtureForTemplate(t: SiteTemplate): StoredBlock[] {
  const byType = new Map<string, (typeof fixtureContent)[number]>();
  for (const b of fixtureContent) if (!byType.has(b.type)) byType.set(b.type, b);

  const base = { showInNav: false, hidden: false };
  const ids = [...t.order, ...Object.keys(t.sections).filter((id) => !t.order.includes(id))];

  return ids
    .map((id) => {
      const def = t.sections[id];
      const content = def ? byType.get(def.block) : undefined;
      return content ? { ...content, ...base, section: id } : null;
    })
    .filter((b) => b !== null) as unknown as StoredBlock[];
}
