import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { designPacks } from "@/lib/design/packs";
import { themePresets, resolveTheme } from "@/lib/theme/presets";
import { Card } from "@/components/ui";

/** Founders-only index of design packs → full-page previews. */
export const dynamic = "force-dynamic";

export default async function PacksIndexPage() {
  if (!(await isPlatformAdmin())) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-canvas px-6 py-12">
      <div className="mb-8">
        <Link href="/admin" className="text-[14px] font-bold text-ink-muted transition-colors hover:text-ink">
          ← Адмінка
        </Link>
        <h1 className="mt-1.5 font-brand text-[24px] font-medium text-ink">Прев&apos;ю дизайнів</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Кожен пакет — фікстурний сайт з усіма типами секцій у його скінах і палітрі.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {designPacks.map((pack) => {
          const theme = resolveTheme(pack.themePresetId);
          const preset = themePresets[pack.themePresetId];
          return (
            <Link key={pack.id} href={`/admin/packs/${pack.id}`}>
              <Card className="flex h-full flex-col gap-2.5 p-5 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-2">
                  {[theme.colors.primary, theme.colors.accent, theme.colors.muted, theme.colors.background].map(
                    (c) => (
                      <span
                        key={c}
                        className="h-5 w-5 rounded-full border border-line"
                        style={{ backgroundColor: c }}
                      />
                    ),
                  )}
                </div>
                <div className="text-[17px] font-extrabold text-ink">{pack.label}</div>
                <div className="text-[14px] leading-snug text-ink-muted">{pack.description}</div>
                <div className="mt-auto text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                  {preset?.label ?? pack.themePresetId} · джерело: {pack.source}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
