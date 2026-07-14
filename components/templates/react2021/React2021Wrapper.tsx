import type { ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { Rubik } from "next/font/google";
import React2021Nav from "./React2021Nav";
import React2021Footer from "./React2021Footer";

/*
 * React-2021 ("react2021") wrapper — scopes the ported energetic-coral landing
 * under `.tpl-react2021` and renders the chrome around the section children. The
 * sections carry their own inline hex palette (coral #ec4755 / dark-ink #1a2e35),
 * so the wrapper only loads the Rubik typeface (exposed as --font-react2021) and
 * hosts Nav/Footer. Single light theme → a plain server component (no toggle).
 */
const rubik = Rubik({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-react2021",
  display: "swap",
});

export default function React2021Wrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  return (
    <div className={`tpl-react2021 ${rubik.variable}`}>
      <React2021Nav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <React2021Footer
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />
    </div>
  );
}
