import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenantByHost, getPublishedPage } from "@/lib/tenant/data";
import { getCachedPublishedPage } from "@/lib/cache";
import { PageRenderer } from "@/components/PageRenderer";
import { getTemplate, type TemplateBrand } from "@/lib/templates/registry";
import { buildTemplateBrand } from "@/lib/templates/brand";
import { displayLogoUrl } from "@/lib/tenant/types";
import {
  canonicalUrl,
  faviconDataUri,
  firstImageFromBlocks,
  localBusinessJsonLd,
  siteDescription,
} from "@/lib/site/seo";

// Tenants/pages render on-demand at first visit, then cache (ISR). The empty
// array is REQUIRED — without it the route becomes fully dynamic, losing cache.
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ host: string; slug?: string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { host, slug } = await params;
  const tenant = await getTenantByHost(host);
  if (!tenant) return {};
  const slugPath = slug?.join("/") ?? "";
  const isHome = slugPath === "";
  const page = await getPublishedPage(host, slugPath);

  const businessName = tenant.brand.businessName;
  const title = page ? `${page.title} · ${businessName}` : businessName;
  const description = siteDescription(tenant);
  const image = page ? firstImageFromBlocks(page.blocks) : undefined;

  return {
    // §10.1 — metadataBase is per-tenant from canonicalHostname, NEVER the
    // platform root (a global base would canonicalize every site onto one host).
    metadataBase: new URL(`https://${tenant.canonicalHostname}`),
    title,
    description,
    // Home → bare canonical origin; sub-pages → relative path resolved against
    // metadataBase (§10.1). Never the request host.
    alternates: { canonical: isHome ? canonicalUrl(tenant, "") : `/${slugPath}` },
    openGraph: {
      title,
      description,
      url: canonicalUrl(tenant, slugPath),
      siteName: businessName,
      locale: "uk_UA",
      type: "website",
      ...(image ? { images: [image] } : {}),
    },
    // A large card only earns its space when we actually have an image (§10.3).
    twitter: { card: image ? "summary_large_image" : "summary" },
    // Per-tenant favicon inlined as a data: URI — no per-site asset infra.
    icons: {
      icon: faviconDataUri(
        businessName,
        tenant.theme.colors.primary,
        tenant.theme.colors.primaryForeground,
      ),
    },
    // §10.4 — keep demo/draft/suspended tenants out of the index; the main
    // scaled-content-abuse safeguard. Only a published tenant is indexable.
    robots: tenant.status === "published" ? undefined : { index: false, follow: false },
  };
}

export default async function TenantPage({ params }: { params: Params }) {
  const { host, slug } = await params;
  const slugPath = slug?.join("/") ?? ""; // "" = home (§5.1.1)
  const page = await getCachedPublishedPage(host, slugPath);
  if (!page) notFound(); // unknown slug → explicit 404 after the DB read (§5.2)

  // One tenant read serves both the template id (which design the site IS) and
  // the JSON-LD below. getTenantByHost already drops suspended tenants.
  const tenant = await getTenantByHost(host);

  // §10.3 — LocalBusiness JSON-LD on the HOME page of a PUBLISHED tenant only.
  // The status guard keeps demo/draft out of structured data too.
  let jsonLd: string | null = null;
  if (slugPath === "" && tenant?.status === "published") {
    jsonLd = localBusinessJsonLd(tenant, firstImageFromBlocks(page.blocks));
  }

  // Feed the template chrome (Nav/Footer) the REAL business identity: the name
  // (its last word becomes the two-tone accent), a nav built from the sections
  // actually on the page, and the "leave a request" CTA target. Absent for
  // pack/legacy sites → the shell renders their own header/footer instead.
  const templateId = tenant?.brand.templateId;
  const template = templateId ? getTemplate(templateId) : undefined;
  let brand: TemplateBrand | undefined;
  if (template && tenant) {
    brand = buildTemplateBrand(
      tenant.brand.businessName ?? "",
      page.blocks,
      template,
      displayLogoUrl(tenant.brand),
    );
  }

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      )}
      <PageRenderer blocks={page.blocks} templateId={templateId} brand={brand} />
    </>
  );
}
