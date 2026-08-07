import { notFound } from "next/navigation";
import { getEditorData } from "@/app/app/(protected)/edit/actions";
import { getTemplate } from "@/lib/templates/registry";
import { buildTemplateBrand } from "@/lib/templates/brand";
import { TENANT_FONT_CLASSES } from "@/lib/fonts";
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

  // A draft whose generation never produced a design has nothing to render as
  // a site — the editor's own empty state covers that case.
  const template = getTemplate(data.templateId);
  if (!template) notFound();

  return (
    <div className={TENANT_FONT_CLASSES}>
      <PageRenderer
        blocks={data.blocks}
        templateId={data.templateId}
        brand={buildTemplateBrand(
          data.businessName,
          data.blocks,
          template,
          data.displayLogoUrl,
          data.wireCss,
          data.designSpec,
        )}
      />
    </div>
  );
}
