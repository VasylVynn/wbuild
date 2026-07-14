import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates/registry";
import { PageRenderer } from "@/components/PageRenderer";
import { fixtureForTemplate } from "@/app/app/(protected)/(shell)/admin/templates/fixture";

/**
 * PUBLIC full-page template preview — deliberately OUTSIDE the (protected) group,
 * so it needs no auth. On the dashboard host the middleware serves `/preview/<id>`
 * straight here; the template's own wrapper owns the look (may be dark). Content
 * is the shared fixture, so no DB and no tenant is involved — this shows a
 * template EXACTLY as a generated site of it would render, for visual review.
 */
export const dynamic = "force-dynamic";

export default async function PublicTemplatePreview({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { templateId } = await params;
  const sp = await searchParams;
  const template = getTemplate(templateId);
  if (!template) notFound();

  // `?v=<variantId>` forces that layout variant on every section that has one
  // (others fall back to their default) — lets a reviewer eyeball all variants.
  const variant = typeof sp.v === "string" ? sp.v : undefined;
  const blocks = fixtureForTemplate(template);
  const withVariant = variant ? blocks.map((b) => ({ ...b, variant })) : blocks;

  return <PageRenderer blocks={withVariant} templateId={template.id} />;
}
