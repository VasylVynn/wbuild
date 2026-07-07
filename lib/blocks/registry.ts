import type { ComponentType } from "react";
import type { BlockProps, BlockType } from "./schema";
import Hero from "@/components/blocks/Hero";
import Services from "@/components/blocks/Services";
import Gallery from "@/components/blocks/Gallery";
import Testimonials from "@/components/blocks/Testimonials";
import Contacts from "@/components/blocks/Contacts";

/**
 * blockType → React component. The SAME registry backs render (here), and
 * later the editing form and the AI block description — they cannot drift
 * (brief §4.1). Each component takes `{ data }` typed to its own props, so a
 * component/schema mismatch is a compile error.
 */
export const blockRegistry: {
  [K in BlockType]: ComponentType<{ data: BlockProps[K] }>;
} = {
  hero: Hero,
  services: Services,
  gallery: Gallery,
  testimonials: Testimonials,
  contacts: Contacts,
};
