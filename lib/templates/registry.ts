import type { ComponentType, ReactNode } from "react";
import {
  studioMeta,
  studioSections,
  type TemplateSectionDef,
} from "@/components/templates/studio";
import { ferriMeta, ferriSections } from "@/components/templates/ferri";
import { salonMeta, salonSections } from "@/components/templates/salon";
import { portfolioMeta, portfolioSections } from "@/components/templates/portfolio";
import { aisaasMeta, aisaasSections } from "@/components/templates/aisaas";
import { nextlyMeta, nextlySections } from "@/components/templates/nextly";
import { react2021Meta, react2021Sections } from "@/components/templates/react2021";
import { restaurantMeta, restaurantSections } from "@/components/templates/restaurant";

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

/**
 * Real business identity the template chrome (Nav/Footer) shows instead of its
 * demo defaults. Absent in previews/fixtures → the chrome keeps its own defaults.
 */
export interface TemplateBrand {
  brandName?: string;
  brandAccent?: string;
  /** Owner's logo (storage URL; already the adapted variant when one is chosen).
   *  Absent → the Nav keeps its text-only brand. */
  logoUrl?: string;
  navLinks?: { href: string; label: string }[];
  ctaHref?: string;
  /** Real contact facts for the footer's «Контакти» column. */
  contact?: {
    phone?: string;
    address?: string;
    hours?: string;
    email?: string;
    telegram?: string;
    viber?: string;
    /** Freeform handle/URL — footers link via instagramHref (contact-links). */
    instagram?: string;
  };
}

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
  /** Outer shell that owns the template's global look (bg, fonts, may be dark)
   *  and its chrome (Nav/Footer); `brand` feeds it the real business identity. */
  wrapper: ComponentType<{ children: ReactNode; brand?: TemplateBrand }>;
  /**
   * Themes this template ships — the per-template theming foundation. Colours
   * are CSS vars on the wrapper; each theme is one value-set toggled by a
   * `data-theme` attribute. First entry is the default. A template may ship
   * one (studio: dark only) or several (ferri: dark + light).
   */
  themes: string[];
  defaultTheme: string;
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
    themes: ["dark"],
    defaultTheme: "dark",
  },
  ferri: {
    id: ferriMeta.id,
    label: ferriMeta.label,
    description: ferriMeta.description,
    verticalIds: ferriMeta.verticalIds,
    order: ferriMeta.order,
    sections: ferriSections,
    wrapper: ferriMeta.wrapper,
    themes: ["dark", "light"],
    defaultTheme: "dark",
  },
  salon: {
    id: salonMeta.id,
    label: salonMeta.label,
    description: salonMeta.description,
    verticalIds: salonMeta.verticalIds,
    order: salonMeta.order,
    sections: salonSections,
    wrapper: salonMeta.wrapper,
    themes: ["light", "dark"],
    defaultTheme: "light",
  },
  portfolio: {
    id: portfolioMeta.id,
    label: portfolioMeta.label,
    description: portfolioMeta.description,
    verticalIds: portfolioMeta.verticalIds,
    order: portfolioMeta.order,
    sections: portfolioSections,
    wrapper: portfolioMeta.wrapper,
    themes: ["dark"],
    defaultTheme: "dark",
  },
  aisaas: {
    id: aisaasMeta.id,
    label: aisaasMeta.label,
    description: aisaasMeta.description,
    verticalIds: aisaasMeta.verticalIds,
    order: aisaasMeta.order,
    sections: aisaasSections,
    wrapper: aisaasMeta.wrapper,
    themes: ["light"],
    defaultTheme: "light",
  },
  nextly: {
    id: nextlyMeta.id,
    label: nextlyMeta.label,
    description: nextlyMeta.description,
    verticalIds: nextlyMeta.verticalIds,
    order: nextlyMeta.order,
    sections: nextlySections,
    wrapper: nextlyMeta.wrapper,
    themes: ["light", "dark"],
    defaultTheme: "light",
  },
  react2021: {
    id: react2021Meta.id,
    label: react2021Meta.label,
    description: react2021Meta.description,
    verticalIds: react2021Meta.verticalIds,
    order: react2021Meta.order,
    sections: react2021Sections,
    wrapper: react2021Meta.wrapper,
    themes: ["light"],
    defaultTheme: "light",
  },
  restaurant: {
    id: restaurantMeta.id,
    label: restaurantMeta.label,
    description: restaurantMeta.description,
    verticalIds: restaurantMeta.verticalIds,
    order: restaurantMeta.order,
    sections: restaurantSections,
    wrapper: restaurantMeta.wrapper,
    themes: ["light"],
    defaultTheme: "light",
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

/** Human-facing template name for UI chips/summaries — the label without its «» quoting. */
export function templateDisplayName(id: string | undefined): string | undefined {
  const t = getTemplate(id);
  return t ? t.label.replace(/[«»]/g, "") : undefined;
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
