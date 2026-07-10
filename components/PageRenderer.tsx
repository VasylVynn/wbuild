import type { ComponentType } from "react";
import { blockRegistry } from "@/lib/blocks/registry";
import { parseBlockProps, type StoredBlock } from "@/lib/blocks/schema";
import { getTemplate } from "@/lib/templates/registry";
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
}: {
  blocks: StoredBlock[];
  templateId?: string;
}) {
  const template = getTemplate(templateId);

  const sections = blocks
    .filter((block) => !block.hidden)
    .map((block, i) => {
      const parsed = parseBlockProps(block.type, block.props);
      if (!parsed.ok) {
        return <UnknownBlock key={i} type={block.type} />;
      }
      const id = block.anchor?.replace(/^#/, "");

      // Template path: render via the template's section component when one
      // exists for this block; otherwise fall through to the default registry.
      const templateComponent = template?.sections[block.section ?? block.type]?.component;
      if (templateComponent) {
        const TemplateComponent = templateComponent as ComponentType<{ data: unknown }>;
        return (
          <section key={i} id={id}>
            <TemplateComponent data={parsed.props} />
          </section>
        );
      }

      const Component = blockRegistry[parsed.type] as ComponentType<{
        data: unknown;
        skin?: string;
      }>;
      return (
        <section key={i} id={id}>
          <Component data={parsed.props} skin={block.skin} />
        </section>
      );
    });

  if (template) {
    const Wrapper = template.wrapper;
    return <Wrapper>{sections}</Wrapper>;
  }
  return <>{sections}</>;
}
