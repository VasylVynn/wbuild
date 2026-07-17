import type { Theme } from "@/lib/theme/tokens";
import type { StoredBlock } from "@/lib/blocks/schema";

/**
 * Two-level data model (brief §5.1):
 *   - Tenant (site config): brand, footer, nav mode, theme, facts, canonical host.
 *   - Page: an ordered list of blocks.
 * Header/footer/nav are NOT copied per page — they live on the tenant.
 */

export type TenantStatus = "demo" | "draft" | "published" | "suspended";
export type NavMode = "onepage" | "multipage";

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
  navMode: NavMode;
  status: TenantStatus;
  brand: {
    businessName: string;
    tagline?: string;
    logoUrl?: string;
    /** Palette-adapted variant of logoUrl (H1) — generated, lives in our bucket.
     *  The ORIGINAL upload is never touched; this sits alongside it. */
    logoAdaptedUrl?: string;
    /** Owner's pick in the editor «Лого» sheet. Absent = show the adapted
     *  variant when one exists (fail-open to the original otherwise). */
    logoDisplay?: "original" | "adapted";
    /** Owner-uploaded photos (§4.8) — the trusted source for hero/gallery imagery. */
    photos?: string[];
    /** Atmospheric hero background generated when the owner has NO photos (§4.8).
     *  Reused on regeneration — never a real venue/product; hero-only, no gallery. */
    generatedHero?: string;
    /** Design source id (persisted for continuity on regenerate). Exactly one is
     *  set: `templateId` (template site — read by the render path) or `packId`. */
    packId?: string;
    templateId?: string;
  };
  footer: {
    phone?: string;
    address?: string;
    hours?: string;
    social?: { label: string; href: string }[];
    copyright?: string;
  };
  theme: Theme;
  /** Structured questionnaire facts — the grounding source (§4.4). Typed per
   *  vertical elsewhere; kept open here so the model is vertical-agnostic. */
  facts: Record<string, unknown>;
}

/**
 * The logo the SITE shows (H1): the adapted variant by default when present,
 * unless the owner explicitly toggled «Оригінал». Always falls back to the
 * original upload — adaptation failing can never lose the logo.
 */
export function displayLogoUrl(brand: Tenant["brand"]): string | undefined {
  if (brand.logoDisplay === "original") return brand.logoUrl;
  return brand.logoAdaptedUrl ?? brand.logoUrl;
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
}

/** A nav item projected from data (§5.3) — never edited by hand. */
export interface NavItem {
  label: string;
  href: string; // "#services" (one-page) or "/contacts" (multi-page)
}
