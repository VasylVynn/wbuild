import type { ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import AiSaasNav from "./AiSaasNav";
import AiSaasFooter from "./AiSaasFooter";

/*
 * AI-SaaS ("ai-saas-landing") wrapper — scopes the light soft-pastel design
 * under `.tpl-aisaas` and renders the chrome around the section children. The
 * sections carry their own inline hex palette, so the wrapper only loads the
 * Quicksand typeface (exposed as --font-aisaas) and hosts Nav/Footer. Single
 * light theme → a plain server component.
 */
export default function AiSaasWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  return (
    <div className="tpl-aisaas" style={{ "--font-aisaas": "'Quicksand'" } as React.CSSProperties}>
      <AiSaasNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        logoUrl={brand?.logoUrl}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <AiSaasFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />
    </div>
  );
}
