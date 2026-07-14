import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { siteTemplates } from "@/lib/templates/registry";
import { getVertical } from "@/lib/verticals/registry";
import { Card } from "@/components/ui";

/** Founders-only index of site templates → full-page previews. */
export const dynamic = "force-dynamic";

export default async function TemplatesIndexPage() {
  if (!(await isPlatformAdmin())) notFound();

  const templates = Object.values(siteTemplates);

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin" className="text-[14px] font-bold text-ink-muted transition-colors hover:text-ink">
          ← Адмінка
        </Link>
        <h1 className="mt-1.5 font-brand text-[24px] font-medium text-ink">Шаблони</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Кожен шаблон — цілісний дизайн із власними секціями, палітрою й типографікою. Згенерований
          сайт ним і стає — не набором скінів.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {templates.map((t) => (
          <Link key={t.id} href={`/admin/templates/${t.id}`}>
            <Card className="flex h-full flex-col gap-2.5 p-5 transition-shadow hover:shadow-md">
              <div className="text-[17px] font-extrabold text-ink">{t.label}</div>
              <div className="text-[14px] leading-snug text-ink-muted">{t.description}</div>
              <div className="mt-auto text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                {t.order.length} секцій · {t.verticalIds.map((v) => getVertical(v).label).join(", ")}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
