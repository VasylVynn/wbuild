import type { ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import RestaurantNav from "./RestaurantNav";
import RestaurantFooter from "./RestaurantFooter";

/*
 * Restaurant ("restaurant") wrapper — scopes the warm hospitality design under
 * `.tpl-restaurant` and renders the chrome around the section children. Sections
 * carry their own inline hex palette (terracotta #C0562F / ink #2A2018 / gold
 * #B7791F on a cream #FBF6EF canvas), so the wrapper only loads the typefaces —
 * Lora (display serif → --font-restaurant-display, used for every heading via the
 * scope) and Inter (body → --font-restaurant-body) — and hosts Nav/Footer. Single
 * light theme → a plain server component (no toggle).
 */
export default function RestaurantWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  return (
    <div className="tpl-restaurant" style={{ "--font-restaurant-display": "'Lora'", "--font-restaurant-body": "'Inter'" } as React.CSSProperties}>
      <RestaurantNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        logoUrl={brand?.logoUrl}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <RestaurantFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />
    </div>
  );
}
