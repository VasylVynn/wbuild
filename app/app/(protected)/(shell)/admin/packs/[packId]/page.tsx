import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { designPacks, getPack } from "@/lib/design/packs";
import { resolveTheme } from "@/lib/theme/presets";
import { themeToCssVars } from "@/lib/theme/tokens";
import { PageRenderer } from "@/components/PageRenderer";
import { fixtureBlocks } from "../fixture";

/**
 * Founders-only full-page preview of ONE design pack: fixture content rendered
 * through the REAL block registry + PageRenderer with the pack's theme vars —
 * exactly what a generated tenant site would produce with this pack.
 */
export const dynamic = "force-dynamic";

export default async function PackPreviewPage({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  if (!(await isPlatformAdmin())) notFound();
  const { packId } = await params;
  const pack = getPack(packId);
  if (!pack) notFound();

  const theme = resolveTheme(pack.themePresetId);

  return (
    <div>
      {/* Admin chrome: pack switcher */}
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        <Link href="/admin/packs" className="mr-2 text-[13px] font-bold text-ink-muted hover:text-ink">
          ← Всі дизайни
        </Link>
        {designPacks.map((p) => (
          <Link
            key={p.id}
            href={`/admin/packs/${p.id}`}
            className={`rounded-full border px-3 py-1 text-[13px] font-bold transition-colors ${
              p.id === pack.id
                ? "border-brand bg-brand text-white"
                : "border-line-strong bg-surface text-ink hover:border-brand hover:text-brand"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* The preview itself — tenant-like shell with the pack's tokens */}
      <div
        style={{
          ...themeToCssVars(theme),
          backgroundColor: "var(--color-background)",
          color: "var(--color-foreground)",
          fontFamily: "var(--font-body)",
        }}
      >
        <PageRenderer blocks={fixtureBlocks(pack)} />
      </div>
    </div>
  );
}
