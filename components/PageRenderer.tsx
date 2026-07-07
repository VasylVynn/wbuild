import type { ComponentType } from "react";
import { blockRegistry } from "@/lib/blocks/registry";
import { parseBlockProps, type StoredBlock } from "@/lib/blocks/schema";
import UnknownBlock from "@/components/blocks/UnknownBlock";

/**
 * Render a page from its blocks (brief §4.1):
 *  - validate each block's props against the registry;
 *  - on failure, fall back to UnknownBlock so ONE bad block never crashes the
 *    whole site;
 *  - skip hidden blocks (§3);
 *  - map anchor ("#services") → section id so one-page nav can scroll to it.
 *
 * Generation stays strict elsewhere (pageContentSchema.parse rejects invalid
 * AI output); this render path is deliberately resilient for stored data.
 */
export function PageRenderer({ blocks }: { blocks: StoredBlock[] }) {
  return (
    <>
      {blocks
        .filter((block) => !block.hidden)
        .map((block, i) => {
          const parsed = parseBlockProps(block.type, block.props);
          if (!parsed.ok) {
            return <UnknownBlock key={i} type={block.type} />;
          }
          const id = block.anchor?.replace(/^#/, "");
          const Component = blockRegistry[parsed.type] as ComponentType<{ data: unknown }>;
          return (
            <section key={i} id={id}>
              <Component data={parsed.props} />
            </section>
          );
        })}
    </>
  );
}
