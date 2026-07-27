import type { StoredBlock } from "@/lib/blocks/schema";

/**
 * Two-level data model (brief §5.1):
 *   - Tenant (site config): brand, footer, facts, canonical host.
 *   - Page: an ordered list of blocks.
 * Header/footer/nav are NOT copied per page — they live on the tenant.
 */

export type TenantStatus = "demo" | "draft" | "published" | "suspended";

export interface Tenant {
  id: string;
  /**
   * Host key used for routing. For MVP subdomains this is the full host
   * (e.g. "kvity.lvh.me" in dev, "kvity.vitryna.com.ua" in prod).
   */
  host: string;
  /** §2.4 — the ONE chosen host; every absolute URL (canonical, og:url,
   *  sitemap, JSON-LD, metadataBase) is built from this, never the request host. */
  canonicalHostname: string;
  status: TenantStatus;
  brand: {
    businessName: string;
    tagline?: string;
    logoUrl?: string;
    /** Owner-uploaded photos (§4.8) — the trusted source for hero/gallery imagery. */
    photos?: string[];
    /** Atmospheric hero background generated when the owner has NO photos (§4.8).
     *  Reused on regeneration — never a real venue/product; hero-only, no gallery. */
    generatedHero?: string;
    /** Generation counter seeding the design hue (lib/design/seed.ts). A
     *  counter, not a design — the site's actual look lives on the page content
     *  so a draft regeneration cannot change the live site (invariant 6). */
    designNonce?: number;
  };
  footer: {
    phone?: string;
    address?: string;
    hours?: string;
    social?: { label: string; href: string }[];
    copyright?: string;
  };
  /** Structured questionnaire facts — the grounding source (§4.4). Typed per
   *  vertical elsewhere; kept open here so the model is vertical-agnostic. */
  facts: Record<string, unknown>;
}


/** Page-level SEO meta (wave D1): written by generation, editable by the
 *  editor agent. Versioned WITH the content — lives in draft_content.seo and
 *  is promoted to published_content.seo on publish, so AI edits stay in the
 *  draft until the owner publishes (§5.5 / invariant 6). */
export interface PageSeo {
  title?: string;
  description?: string;
}

export interface Page {
  id: string;
  tenantId: string;
  /** "" = home. Stored without leading/trailing slash (§5.1.1). */
  slug: string;
  pageType: string; // "home" for MVP
  title: string;
  isPublished: boolean;
  showInNav: boolean;
  navOrder: number;
  /** Public render reads the PUBLISHED blocks only (§5.5). */
  blocks: StoredBlock[];
  /** Published SEO meta (public render); undefined for pre-wave-D sites. */
  seo?: PageSeo;
  /** The template these blocks were composed against, and the stylesheet
   *  written for them. Versioned WITH the content (draft vs published) rather
   *  than on the unversioned `brand`, so regenerating a draft cannot change the
   *  live site (invariant 6). */
  templateId?: string;
  wireCss?: string;
}

