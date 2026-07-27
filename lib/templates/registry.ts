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
import { sparkMeta, sparkSections } from "@/components/templates/spark";
import { belezaMeta, belezaSections } from "@/components/templates/beleza";
import { launchMeta, launchSections } from "@/components/templates/launch";
import { salonwireMeta, salonwireSections } from "@/components/templates/salonwire";

/**
 * Site templates — the owner mandate (2026-07): a generated site must BE a
 * chosen source template. The model picks a `templateId`, then composes the page
 * ONLY from that template's sections; the template dictates the ENTIRE look — its
 * own palette, fonts, animations and wrapper (may be dark).
 *
 * This is deliberately NOT "server-only": the render path (PageRenderer) and the
 * admin previews import it on both the server and client boundary. A template is
 * built from a `components/templates/<id>` module's meta + sections.
 *
 */
export type { TemplateSectionDef };

/**
 * Real business identity the template chrome (Nav/Footer) shows instead of its
 * demo defaults. Absent in previews/fixtures → the chrome keeps its own defaults.
 */
export interface TemplateBrand {
  brandName?: string;
  brandAccent?: string;
  /** Owner's logo (storage URL). Absent → the Nav keeps its text-only brand. */
  logoUrl?: string;
  navLinks?: { href: string; label: string }[];
  ctaHref?: string;
  /** The stylesheet the model wrote for THIS site, injected after the
   *  wireframe's own CSS. Legacy templates ignore it. */
  wireCss?: string;
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
}

export const legacyTemplates: Record<string, SiteTemplate> = {
  studio: {
    id: studioMeta.id,
    label: studioMeta.label,
    description: studioMeta.description,
    verticalIds: studioMeta.verticalIds,
    order: studioMeta.order,
    sections: studioSections,
    wrapper: studioMeta.wrapper,
  },
  ferri: {
    id: ferriMeta.id,
    label: ferriMeta.label,
    description: ferriMeta.description,
    verticalIds: ferriMeta.verticalIds,
    order: ferriMeta.order,
    sections: ferriSections,
    wrapper: ferriMeta.wrapper,
    // Restored in DNA-2c: ferri now reads fonts through --ferri-display/--ferri-body
    // indirections (C3), so pairs render for real.
  },
  salon: {
    id: salonMeta.id,
    label: salonMeta.label,
    description: salonMeta.description,
    verticalIds: salonMeta.verticalIds,
    order: salonMeta.order,
    sections: salonSections,
    wrapper: salonMeta.wrapper,
  },
  portfolio: {
    id: portfolioMeta.id,
    label: portfolioMeta.label,
    description: portfolioMeta.description,
    verticalIds: portfolioMeta.verticalIds,
    order: portfolioMeta.order,
    sections: portfolioSections,
    wrapper: portfolioMeta.wrapper,
  },
  aisaas: {
    id: aisaasMeta.id,
    label: aisaasMeta.label,
    description: aisaasMeta.description,
    verticalIds: aisaasMeta.verticalIds,
    order: aisaasMeta.order,
    sections: aisaasSections,
    wrapper: aisaasMeta.wrapper,
  },
  nextly: {
    id: nextlyMeta.id,
    label: nextlyMeta.label,
    description: nextlyMeta.description,
    verticalIds: nextlyMeta.verticalIds,
    order: nextlyMeta.order,
    sections: nextlySections,
    wrapper: nextlyMeta.wrapper,
  },
  react2021: {
    id: react2021Meta.id,
    label: react2021Meta.label,
    description: react2021Meta.description,
    verticalIds: react2021Meta.verticalIds,
    order: react2021Meta.order,
    sections: react2021Sections,
    wrapper: react2021Meta.wrapper,
  },
  spark: {
    id: sparkMeta.id,
    label: sparkMeta.label,
    description: sparkMeta.description,
    verticalIds: sparkMeta.verticalIds,
    order: sparkMeta.order,
    sections: sparkSections,
    wrapper: sparkMeta.wrapper,
  },
  beleza: {
    id: belezaMeta.id,
    label: belezaMeta.label,
    description: belezaMeta.description,
    verticalIds: belezaMeta.verticalIds,
    order: belezaMeta.order,
    sections: belezaSections,
    wrapper: belezaMeta.wrapper,
  },
  launch: {
    id: launchMeta.id,
    label: launchMeta.label,
    description: launchMeta.description,
    verticalIds: launchMeta.verticalIds,
    order: launchMeta.order,
    sections: launchSections,
    wrapper: launchMeta.wrapper,
  },
  restaurant: {
    id: restaurantMeta.id,
    label: restaurantMeta.label,
    description: restaurantMeta.description,
    verticalIds: restaurantMeta.verticalIds,
    order: restaurantMeta.order,
    sections: restaurantSections,
    wrapper: restaurantMeta.wrapper,
  },
};

/**
 * The production catalog — one structural wireframe. Every site is composed
 * against it and then dressed by a stylesheet the model writes for that
 * business (lib/design/wire-style.ts), so «which template» is no longer a
 * choice anyone makes: uniqueness comes from the CSS, not from picking one of
 * eleven fixed looks.
 *
 * The eleven old templates stay in `legacyTemplates` above as the source
 * material for porting structural layouts into the wireframe. They are
 * resolvable by id (dev/admin preview routes) but are never generated into,
 * never offered to an owner, and never named to a model.
 */
export const siteTemplates: Record<string, SiteTemplate> = {
  salonwire: {
    id: salonwireMeta.id,
    label: salonwireMeta.label,
    description: salonwireMeta.description,
    verticalIds: salonwireMeta.verticalIds,
    order: salonwireMeta.order,
    sections: salonwireSections,
    wrapper: salonwireMeta.wrapper,
  },
};

export function getTemplate(id: string | undefined): SiteTemplate | undefined {
  if (!id) return undefined;
  return siteTemplates[id] ?? legacyTemplates[id];
}
