import type { ComponentType } from "react";
import { blockRegistry } from "@/lib/blocks/registry";
import { parseBlockProps, type StoredBlock } from "@/lib/blocks/schema";
import { getTemplate, type TemplateBrand } from "@/lib/templates/registry";
import UnknownBlock from "@/components/blocks/UnknownBlock";

/**
 * Render a page from its blocks (brief §4.1):
 *  - validate each block's props against the registry;
 *  - on failure, fall back to UnknownBlock so ONE bad block never crashes the
 *    whole site;
 *  - skip hidden blocks (§3);
 *  - map anchor ("#services") → section id so one-page nav can scroll to it.
 *
 * When `templateId` resolves, the site IS that template: everything is wrapped in
 * the template's shell (its own palette/fonts, may be dark) and each block renders
 * through the template's section component, keyed by `block.section` (falling back
 * to the block type, then to the default block registry — which keeps legacy/
 * sectionless blocks and unmapped types alive). Without a template, the classic
 * registry path renders each block with its skin.
 *
 * Generation stays strict elsewhere (pageContentSchema.parse rejects invalid
 * AI output); this render path is deliberately resilient for stored data.
 */
export function PageRenderer({
  blocks,
  templateId,
  brand,
}: {
  blocks: StoredBlock[];
  templateId?: string;
  brand?: TemplateBrand;
}) {
  const template = getTemplate(templateId);

  const sections = blocks
    .filter((block) => !block.hidden)
    .map((block, i) => {
      const parsed = parseBlockProps(block.type, block.props);
      if (!parsed.ok) {
        return <UnknownBlock key={i} type={block.type} />;
      }
      // On a template site the section id IS the template section id (so the
      // template's nav anchors like #features/#pricing resolve); pack/legacy
      // sites key on the block's own anchor.
      const id = template && block.section ? block.section : block.anchor?.replace(/^#/, "");

      // Template path: render via the template's section component when one
      // exists for this block; otherwise fall through to the default registry.
      // A block may carry a `variant` id → an alternate layout of that section;
      // unknown/absent variants fall back to the section's default component.
      const sectionDef = template?.sections[block.section ?? block.type];
      // Only render through the template section when the stored block type
      // matches the section's block schema — otherwise (corrupt/legacy data)
      // wrong props would reach the wrong component. Fall through to default.
      const matched = sectionDef?.block === parsed.type ? sectionDef : undefined;
      const templateComponent =
        (block.variant ? matched?.variants?.[block.variant] : undefined) ??
        matched?.component;
      if (templateComponent) {
        const TemplateComponent = templateComponent as ComponentType<{ data: unknown }>;
        return (
          <section key={i} id={id}>
            <TemplateComponent data={parsed.props} />
          </section>
        );
      }

      const Component = blockRegistry[parsed.type] as
        | ComponentType<{ data: unknown; skin?: string }>
        | undefined;
      // Template-only block types have no default component — off a template
      // (pack/legacy path) they can't render, so fall back rather than crash.
      if (!Component) return <UnknownBlock key={i} type={block.type} />;
      return (
        <section key={i} id={id}>
          <Component data={parsed.props} skin={block.skin} />
        </section>
      );
    });

  if (template) {
    const Wrapper = template.wrapper;
    return <Wrapper brand={brand}>{sections}</Wrapper>;
  }
  return <>{sections}</>;
}
