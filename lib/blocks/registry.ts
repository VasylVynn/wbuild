import type { ComponentType } from "react";
import type { BlockProps, BlockType } from "./schema";
import Hero from "@/components/blocks/Hero";
import RichText from "@/components/blocks/RichText";
import Switchback from "@/components/blocks/Switchback";
import Services from "@/components/blocks/Services";
import Gallery from "@/components/blocks/Gallery";
import Stats from "@/components/blocks/Stats";
import Testimonials from "@/components/blocks/Testimonials";
import Faq from "@/components/blocks/Faq";
import Cta from "@/components/blocks/Cta";
import LeadForm from "@/components/blocks/LeadForm";
import Contacts from "@/components/blocks/Contacts";
import Map from "@/components/blocks/Map";
import InstagramCta from "@/components/blocks/InstagramCta";

/**
 * blockType → React component. The SAME registry backs render (here), and
 * later the editing form and the AI block description — they cannot drift
 * (brief §4.1). Each component takes `{ data }` typed to its own props, so a
 * component/schema mismatch is a compile error.
 *
 * Partial: newer TEMPLATE-only block types (team/timeline/marquee/publications)
 * have no default/pack component — they render ONLY through a template's section
 * component. The render path falls back to UnknownBlock if one is ever missing.
 */
export const blockRegistry: Partial<{
  [K in BlockType]: ComponentType<{ data: BlockProps[K]; skin?: string }>;
}> = {
  hero: Hero,
  richText: RichText,
  switchback: Switchback,
  services: Services,
  gallery: Gallery,
  stats: Stats,
  testimonials: Testimonials,
  faq: Faq,
  cta: Cta,
  lead_form: LeadForm,
  contacts: Contacts,
  map: Map,
  instagram_cta: InstagramCta,
};
