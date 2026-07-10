import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { siteTemplates, getTemplate } from "@/lib/templates/registry";
import { PageRenderer } from "@/components/PageRenderer";
import { fixtureForTemplate } from "../fixture";

/**
 * Founders-only full-page preview of ONE template: fixture content rendered
 * through PageRenderer WITH the templateId — the template's own wrapper + section
 * components, exactly what a generated tenant site of this template produces. The
 * admin chrome (switcher) uses the platform theme; the preview below owns its own
 * look (may be dark).
 */
export const dynamic = "force-dynamic";

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  if (!(await isPlatformAdmin())) notFound();
  const { templateId } = await params;
  const template = getTemplate(templateId);
  if (!template) notFound();

  return (
    <div>
      {/* Admin chrome: template switcher */}
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        <Link href="/admin/templates" className="mr-2 text-[13px] font-bold text-ink-muted hover:text-ink">
          ← Всі шаблони
        </Link>
        {Object.values(siteTemplates).map((t) => (
          <Link
            key={t.id}
            href={`/admin/templates/${t.id}`}
            className={`rounded-full border px-3 py-1 text-[13px] font-bold transition-colors ${
              t.id === template.id
                ? "border-brand bg-brand text-white"
                : "border-line-strong bg-surface text-ink hover:border-brand hover:text-brand"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* The preview itself — the template's own shell + section components. */}
      <PageRenderer blocks={fixtureForTemplate(template)} templateId={template.id} />
    </div>
  );
}
