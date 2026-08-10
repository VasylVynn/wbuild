import type { StoredBlock } from "@/lib/blocks/schema";
import type { DesignSpec } from "@/lib/site/design-spec";

/**
 * Two-level data model (brief §5.1):
 *   - Tenant (site config): brand, footer, facts, canonical host.
 *   - Page: an ordered list of blocks.
 * Header/footer/nav are NOT copied per page — they live on the tenant.
 */

export type TenantStatus = "demo" | "draft" | "published" | "suspended";

/**
 * THE logo record on `tenants.brand` — declared ONCE, here, and re-exported as
 * `BrandLogoSource` from lib/templates/brand.ts, which is where it is consumed.
 * The render path hands `tenant.brand` over WHOLE (`buildTemplateBrand` →
 * `resolveDisplayLogo`), so every field it reads must be declared on the tenant
 * model too: a second, partial declaration is how a renamed or dropped write
 * passes the compiler and fails in production.
 */
export interface BrandLogoRecord {
  /** The owner's ORIGINAL upload. Never rewritten, never deleted. */
  logoUrl?: string;
  /** Our sibling-stored adaptation of it (lib/media/logo.ts): the same artwork
   *  with a baked-in canvas masked to real alpha. Written ONLY when the pixels
   *  proved what could be removed — absent means "we could not prove it", not
   *  "we did not try". */
  logoAdaptedUrl?: string;
  /** Backdrop measured from the ORIGINAL's own pixels at import: `"none"` (the
   *  asset has a transparent background) or a hex (it is opaque, so the chrome
   *  renders a matching chip behind it instead of letting a black square read
   *  as a rendering accident). A MEASUREMENT, not a design choice — see
   *  TemplateBrand.logoPlate. Absent → no plate. */
  logoPlate?: string;
  /** Mean CIE L* of the ink that will actually be DISPLAYED — the adapted mark
   *  when there is one, otherwise the owner's own asset. Masking a canvas away
   *  removes the contrast that came with it, and an asset that shipped alpha
   *  never had any: both cases can leave artwork the same tone as the surface
   *  under it, and only a measurement tells them from artwork that reads fine.
   *  Measured, never chosen. Absent → no chip. */
  logoInkL?: number;
}

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
  /** The logo record (`BrandLogoRecord`) is mixed in whole — the render path
   *  passes `tenant.brand` straight into `buildTemplateBrand`. */
  brand: BrandLogoRecord & {
    businessName: string;
    tagline?: string;
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
  /** The S1 design brief (pipeline v2 §3) — PUBLISHED copy. The renderer reads
   *  typography (`pairId`) and motion level from it; absent (pre-v2 sites or
   *  S1 fallback) → the wireframe's own CSS fallbacks apply. */
  designSpec?: DesignSpec;
}

