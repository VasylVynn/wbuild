import type { ComponentType, ReactNode } from "react";
import {
  studioMeta,
  studioSections,
  type TemplateSectionDef,
} from "@/components/templates/studio";

/**
 * Site templates — the owner mandate (2026-07): a generated site must BE a
 * chosen source template. The model picks a `templateId`, then composes the page
 * ONLY from that template's sections; the template dictates the ENTIRE look — its
 * own palette, fonts, animations, wrapper (may be dark) — not a per-block skin.
 *
 * This is deliberately NOT "server-only": the render path (PageRenderer) and the
 * admin previews import it on both the server and client boundary. A template is
 * built from a `components/templates/<id>` module's meta + sections.
 *
 * Templates and design packs coexist: a vertical WITH a template affinity uses
 * the template path (packs ignored); a vertical WITHOUT one falls back to packs.
 */
export type { TemplateSectionDef };

export interface SiteTemplate {
  id: string;
  label: string;
  description: string;
  /** Vertical affinity — which niches this template is offered to. */
  verticalIds: string[];
  /** Canonical section order — a composition hint for the model, not a hard rule. */
  order: string[];
  /** Section id → its block type + preview component. */
  sections: Record<string, TemplateSectionDef>;
  /** Outer shell that owns the template's global look (bg, fonts, may be dark). */
  wrapper: ComponentType<{ children: ReactNode }>;
}

export const siteTemplates: Record<string, SiteTemplate> = {
  studio: {
    id: studioMeta.id,
    label: studioMeta.label,
    description: studioMeta.description,
    verticalIds: studioMeta.verticalIds,
    order: studioMeta.order,
    sections: studioSections,
    wrapper: studioMeta.wrapper,
  },
};

/** Non-empty tuple for z.enum — there is always at least one template (studio). */
export const TEMPLATE_IDS: [string, ...string[]] = Object.keys(siteTemplates) as [
  string,
  ...string[],
];

export function getTemplate(id: string | undefined): SiteTemplate | undefined {
  if (!id) return undefined;
  return siteTemplates[id];
}

/**
 * Templates whose affinity includes this vertical. Empty is allowed: a vertical
 * with no template affinity falls back to design packs in generation.
 */
export function templatesFor(verticalId?: string): SiteTemplate[] {
  return Object.values(siteTemplates).filter(
    (t) => verticalId != null && t.verticalIds.includes(verticalId),
  );
}
