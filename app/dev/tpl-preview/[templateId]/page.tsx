import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates/registry";
import { fixtureForTemplate } from "@/app/app/(protected)/(shell)/admin/templates/fixture";
import { PageRenderer } from "@/components/PageRenderer";
import { TENANT_FONT_CLASSES } from "@/lib/theme/fonts";

/**
 * DEV-ONLY unauthenticated template preview (wave TPL-3 QA): renders a
 * template's ENTIRE section menu with fixture content — the same blocks the
 * admin preview shows, but reachable by headless QA agents. ?theme= forces a
 * data-theme via the wrappers' existing param mechanics.
 */
export const dynamic = "force-dynamic";

export default async function DevTplPreview({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { templateId } = await params;
  const template = getTemplate(templateId);
  if (!template) notFound();
  return (
    <div className={TENANT_FONT_CLASSES}>
      <PageRenderer blocks={fixtureForTemplate(template)} templateId={templateId} />
    </div>
  );
}
