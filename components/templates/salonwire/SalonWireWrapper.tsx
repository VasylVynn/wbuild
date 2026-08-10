import type { CSSProperties, ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { wireDesignAttrs } from "@/lib/design/wire-attrs";
import { CSS_SIZE_LIMIT } from "@/lib/design/css-size";
import { wireChromeVariants } from "./chrome-variants";
import {
  instagramHref,
  mailtoHref,
  normalizeIgHandle,
  normalizeUaPhoneDigits,
  telegramHref,
} from "@/lib/blocks/contact-links";
import "./wire.css";

/**
 * salonwire wrapper — nav, footer, and the injection point for the generated
 * stylesheet (design spike, 2026-07-27).
 *
 * The wireframe ships grey. `brand.wireCss` — a stylesheet written by the model
 * for THIS tenant and stored on its row — is injected after `wire.css`, so it
 * wins on equal specificity without needing `!important`.
 */

const BLOCKED = [
  /@import/gi,
  /javascript:/gi,
  /expression\s*\(/gi,
  /<\s*\/?\s*(script|style|iframe)/gi,
  /behavior\s*:/gi,
  /-moz-binding/gi,
  // §4.8 / spec v2 §3-S3: url() to a REMOTE origin is network egress —
  // css-lint strips those before persist, this belt re-blocks them at render
  // (a sheet that reached storage unlinted must still not phone home). It
  // mirrors css-lint's policy exactly: http(s) and protocol-relative only —
  // `data:` URIs are not egress, and the stylist prompt legitimately uses
  // inline-SVG background patterns (blanket-blocking every `url(` mangled
  // those declarations into unbalanced garbage the CSS parser dropped).
  /url\s*\(\s*['"]?(?:https?:)?\/\//gi,
];

/**
 * Minimal hardening for model-authored CSS. CSS cannot execute script in modern
 * browsers, but `@import` and remote `url()` are network egress, and a stray
 * closing tag would break out of the <style> element. Dev-spike grade, not a
 * substitute for a real sanitiser if this ever ships.
 */
function sanitizeCss(css: string): string {
  // The ONE size contract (lib/design/css-size.ts, spec §9.3): compile and the
  // audit clamp to the same number WITH a report note — this slice is only the
  // belt for legacy rows written before the contract.
  let out = css.slice(0, CSS_SIZE_LIMIT);
  for (const re of BLOCKED) out = out.replace(re, "/*blocked*/");
  return out;
}

/** The complete business name: `brandName` already carries a trailing space
 *  when a `brandAccent` was split off, so a plain concat restores the original. */
function fullBrandName(brand?: TemplateBrand): string {
  const joined = `${brand?.brandName ?? ""}${brand?.brandAccent ?? ""}`.trim();
  return joined || "Назва бізнесу";
}

/** A plate colour is a MEASUREMENT of the owner's asset, but it lands in a
 *  style attribute, so only a literal hex is ever let through — `"none"`,
 *  anything malformed and anything absent all mean "no plate". */
const PLATE_HEX = /^#[0-9a-f]{3,8}$/i;
function logoPlate(brand: TemplateBrand | undefined, place: "nav" | "footer"): string | undefined {
  const v = brand?.logoPlate?.trim();
  if (!v || !PLATE_HEX.test(v)) return undefined;
  // A plate scoped to one chrome is a statement about THAT surface's contrast
  // (registry `logoPlatePlace`); an unscoped one is the asset's own square and
  // belongs on both.
  return !brand?.logoPlatePlace || brand.logoPlatePlace === place ? v : undefined;
}

/** At or beyond this width-to-height ratio a mark is a WORDMARK: artwork whose
 *  content IS the business name. Below it the mark is an icon that needs the
 *  name spelled out beside it. 3:1 because a square-ish emblem, a shield and a
 *  circular badge all sit far below it, while «name set in a typeface», with or
 *  without a small glyph in front, sits far above. Absent measurement → icon,
 *  i.e. today's lockup, which is never wrong-looking, only redundant. */
const WORDMARK_MIN_ASPECT = 3;
function isWordmark(brand?: TemplateBrand): boolean {
  return typeof brand?.logoAspect === "number" && brand.logoAspect >= WORDMARK_MIN_ASPECT;
}

/**
 * The owner's logo — ONE component for both chrome placements (invariant: the
 * brand mark never has two geometries). `.wire-brandmark` carries the locked
 * geometry, the `--nav`/`--footer` alias only sets its size, and the plate is
 * an inline custom property because it is per-tenant data, not a design choice.
 *
 * `brand.logoUrl` is the DISPLAY mark, already resolved upstream
 * (`resolveDisplayLogo`, lib/templates/brand.ts): the adapted asset when the
 * import could prove and remove a background, the owner's original otherwise.
 * The wrapper deliberately does not know which it got — one field, one <img>,
 * the same component in the nav and in the footer, so the two placements can
 * never drift apart.
 *
 * `alt` follows the lockup: an icon sits beside the name as text, so announcing
 * it twice is noise and the mark is decorative (`alt=""`). A WORDMARK replaces
 * that text, so it must carry the name itself or the business becomes nameless
 * to a screen reader and to search.
 */
function BrandMark({
  src,
  place,
  plate,
  alt,
}: {
  src: string;
  place: "nav" | "footer";
  plate?: string;
  alt: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`wire-brandmark wire-${place}__logo${plate ? " wire-brandmark--plated" : ""}`}
      src={src}
      alt={alt}
      {...(plate
        ? { style: { "--wire-brandmark-plate": plate } as CSSProperties }
        : {})}
    />
  );
}

export function SalonWireWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  const generated = brand?.wireCss ? sanitizeCss(brand.wireCss) : null;
  // Fonts + motion come from the designSpec at render time, NOT from the
  // generated stylesheet (pipeline v2 §3-S3). No designSpec → no attributes;
  // wire.css's `var(--font-heading, inherit)` fallbacks take over.
  const design = wireDesignAttrs(brand?.designSpec);
  // Nav/footer silhouette (spec §5): seeded per site, derived from the same
  // designSpec — see chrome-variants.ts for the interim derivation contract.
  const chrome = wireChromeVariants(brand?.designSpec);
  const wordmark = !!brand?.logoUrl && isWordmark(brand);
  const links = brand?.navLinks ?? [];
  // The footer indexes every section; the nav shows the capped set (brand.ts).
  const indexLinks = brand?.allSectionLinks ?? links;
  const contact = brand?.contact;
  const phoneDigits = contact?.phone ? normalizeUaPhoneDigits(contact.phone) : "";
  const tgHref = telegramHref(contact?.telegram);
  const igHandle = normalizeIgHandle(contact?.instagram);
  const igLink = instagramHref(contact?.instagram);

  return (
    <div
      className="tpl-salonwire"
      {...(design.style ? { style: design.style as CSSProperties } : {})}
      {...(design.motion !== undefined ? { "data-motion": design.motion } : {})}
    >
      {generated && <style dangerouslySetInnerHTML={{ __html: generated }} />}

      <header
        className={`wire-nav${chrome.nav === "centered-brand" ? " wire-nav--centered-brand" : ""}`}
      >
        <div className="wire-container wire-nav__inner">
          {/* brandName/brandAccent are the old templates' two-tone split: the
              last word is handed over separately so their chrome can colour it.
              The wireframe has no two-tone treatment, so it must re-join them —
              rendering brandName alone silently dropped the last word of every
              multi-word business name («Барбершоп Кузня» → «Барбершоп»). */}
          <span className="wire-nav__brandlock">
            {brand?.logoUrl && (
              <BrandMark
                src={brand.logoUrl}
                place="nav"
                plate={logoPlate(brand, "nav")}
                alt={wordmark ? fullBrandName(brand) : ""}
              />
            )}
            {/* A wordmark already spells the name in the owner's own typeface;
                printing it again beside itself is the name twice in two fonts. */}
            {!wordmark && <span className="wire-nav__brand">{fullBrandName(brand)}</span>}
          </span>
          <nav className="wire-nav__links">
            {links.map((l) => (
              <a className="wire-nav__link" href={l.href} key={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <a className="wire-btn wire-btn--primary wire-nav__cta" href={brand?.ctaHref ?? "#lead_form"}>
            Залишити заявку
          </a>
        </div>
      </header>

      <main>{children}</main>

      <footer
        className={`wire-footer${
          chrome.footer === "2col"
            ? " wire-footer--2col"
            : chrome.footer === "single"
              ? " wire-footer--single"
              : ""
        }`}
      >
        <div className="wire-container wire-footer__inner">
          {/* `wire-footer__brandlock` is the footer's half of the identity
              lock (css-lint BRAND_LOCKUP): the sheet may colour and set this
              block, but may not hang a ::before/::after ornament on it — the
              same guarantee the nav's lockup carries. */}
          <div className="wire-stack wire-footer__brandlock">
            {brand?.logoUrl && (
              <BrandMark
                src={brand.logoUrl}
                place="footer"
                plate={logoPlate(brand, "footer")}
                alt={wordmark ? fullBrandName(brand) : ""}
              />
            )}
            {!wordmark && <span className="wire-heading">{fullBrandName(brand)}</span>}
          </div>
          <div className="wire-stack">
            <span className="wire-eyebrow">Контакти</span>
            {contact?.phone &&
              (phoneDigits ? (
                <a className="wire-footer__link" href={`tel:+${phoneDigits}`}>
                  {contact.phone}
                </a>
              ) : (
                <span className="wire-text">{contact.phone}</span>
              ))}
            {contact?.email &&
              (mailtoHref(contact.email) ? (
                // Same contract as the contacts block: the owner's text is the
                // label, the EXTRACTED address is the href, and an unparseable
                // value renders as plain text rather than as a dead mailto.
                <a className="wire-footer__link" href={mailtoHref(contact.email)!}>
                  {contact.email}
                </a>
              ) : (
                <span className="wire-text">{contact.email}</span>
              ))}
            {contact?.address && <span className="wire-text">{contact.address}</span>}
            {tgHref && contact?.telegram && (
              <a className="wire-footer__link" href={tgHref}>
                Telegram
              </a>
            )}
            {igLink && (
              <a className="wire-footer__link" href={igLink}>
                Instagram{igHandle ? ` — @${igHandle}` : ""}
              </a>
            )}
          </div>
          <div className="wire-stack">
            <span className="wire-eyebrow">Години</span>
            {contact?.hours && <span className="wire-text">{contact.hours}</span>}
          </div>
          <div className="wire-stack">
            <span className="wire-eyebrow">Розділи</span>
            {/* The FULL section index, not the nav's capped set: the nav budget
                DROPS overflow rather than hiding it in a menu, which is only
                honest if the dropped section is still listed somewhere. Classes:
                `.wire-footer__link` alone — `.wire-nav__link` is sheet-coloured
                for the LIGHT nav (2.4:1 here) and `.wire-text`'s ink is
                contrast-checked against light surfaces only (see wire.css). */}
            {indexLinks.map((l) => (
              <a className="wire-footer__link" href={l.href} key={l.href}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
