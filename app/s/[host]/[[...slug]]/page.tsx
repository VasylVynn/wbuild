import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenantByHost, getPublishedPage } from "@/lib/tenant/data";
import { getCachedPublishedPage } from "@/lib/cache";
import { PageRenderer } from "@/components/PageRenderer";

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
  const page = await getPublishedPage(host, slug?.join("/") ?? "");
  return {
    // §10.1 — metadataBase is per-tenant from canonicalHostname, NEVER the
    // platform root (a global base would canonicalize every site onto one host).
    metadataBase: new URL(`https://${tenant.canonicalHostname}`),
    title: page ? `${page.title} · ${tenant.brand.businessName}` : tenant.brand.businessName,
    description: tenant.brand.tagline,
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
  return <PageRenderer blocks={page.blocks} />;
}
