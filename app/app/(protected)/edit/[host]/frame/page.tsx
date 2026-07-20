import { notFound } from "next/navigation";
import { getEditorData } from "@/app/app/(protected)/edit/actions";
import { getTemplate } from "@/lib/templates/registry";
import { buildTemplateBrand } from "@/lib/templates/brand";
import { themeToCssVars } from "@/lib/theme/tokens";
import { TENANT_FONT_CLASSES } from "@/lib/theme/fonts";
import { resolveFontPair } from "@/lib/theme/font-pairs";
import { PageRenderer } from "@/components/PageRenderer";

/**
 * Device-preview frame (P2): renders the DRAFT exactly like the published site
 * would look, standalone — EditorShell embeds it in an <iframe> whose width IS
 * the simulated viewport, so Tailwind's sm:/md: breakpoints resolve correctly
 * (a width-constrained inline wrapper can't do that). Read-only by design:
 * editing happens in the editor's «Компʼютер» mode.
 *
 * Auth: inherits the (protected) guard; getEditorData re-checks membership and
 * returns null for non-members → 404. The (protected) layout carries no chrome
 * (P1), so nothing platform-ish leaks into the frame.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function EditorFramePage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const data = await getEditorData(decodeURIComponent(host));
  if (!data) notFound();

  const template = getTemplate(data.templateId);
  if (template) {
    // DNA-2b: mirror the public shell — the rolled pair reaches the template
    // font indirections; absent pair leaves the template untouched.
    const pair = resolveFontPair((data.theme as { fontPairId?: string }).fontPairId);
    return (
      <div
        className={TENANT_FONT_CLASSES}
        {...(pair && {
          style: { "--font-heading": pair.heading, "--font-body": pair.body } as React.CSSProperties,
        })}
      >
        <PageRenderer
          blocks={data.blocks}
          templateId={data.templateId}
          brand={buildTemplateBrand(data.businessName, data.blocks, template, data.displayLogoUrl)}
        />
      </div>
    );
  }

  return (
    <div
      className={TENANT_FONT_CLASSES}
      style={{
        ...themeToCssVars(data.theme),
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
        fontFamily: "var(--font-body)",
        minHeight: "100vh",
      }}
    >
      <PageRenderer blocks={data.blocks} />
    </div>
  );
}
