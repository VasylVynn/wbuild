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
