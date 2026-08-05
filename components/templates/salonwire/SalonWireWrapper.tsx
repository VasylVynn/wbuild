import type { ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import {
  instagramHref,
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
];

/**
 * Minimal hardening for model-authored CSS. CSS cannot execute script in modern
 * browsers, but `@import` and `url()` are network egress, and a stray closing
 * tag would break out of the <style> element. Dev-spike grade, not a substitute
 * for a real sanitiser if this ever ships.
 */
function sanitizeCss(css: string): string {
  let out = css.slice(0, 60_000);
  for (const re of BLOCKED) out = out.replace(re, "/*blocked*/");
  return out;
}

/** The complete business name: `brandName` already carries a trailing space
 *  when a `brandAccent` was split off, so a plain concat restores the original. */
function fullBrandName(brand?: TemplateBrand): string {
  const joined = `${brand?.brandName ?? ""}${brand?.brandAccent ?? ""}`.trim();
  return joined || "Назва бізнесу";
}

export function SalonWireWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  const generated = brand?.wireCss ? sanitizeCss(brand.wireCss) : null;
  const links = brand?.navLinks ?? [];
  const contact = brand?.contact;
  const phoneDigits = contact?.phone ? normalizeUaPhoneDigits(contact.phone) : "";
  const tgHref = telegramHref(contact?.telegram);
  const igHandle = normalizeIgHandle(contact?.instagram);
  const igLink = instagramHref(contact?.instagram);

  return (
    <div className="tpl-salonwire">
      {generated && <style dangerouslySetInnerHTML={{ __html: generated }} />}

      <header className="wire-nav">
        <div className="wire-container wire-nav__inner">
          {/* brandName/brandAccent are the old templates' two-tone split: the
              last word is handed over separately so their chrome can colour it.
              The wireframe has no two-tone treatment, so it must re-join them —
              rendering brandName alone silently dropped the last word of every
              multi-word business name («Барбершоп Кузня» → «Барбершоп»). */}
          <span className="wire-nav__brandlock">
            {brand?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="wire-nav__logo" src={brand.logoUrl} alt="" />
            )}
            <span className="wire-nav__brand">{fullBrandName(brand)}</span>
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

      <footer className="wire-footer">
        <div className="wire-container wire-footer__inner">
          <div className="wire-stack">
            {brand?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="wire-footer__logo" src={brand.logoUrl} alt="" />
            )}
            <span className="wire-heading">{fullBrandName(brand)}</span>
          </div>
          <div className="wire-stack">
            <span className="wire-eyebrow">Контакти</span>
            {contact?.phone &&
              (phoneDigits ? (
                <a className="wire-text wire-footer__link" href={`tel:+${phoneDigits}`}>
                  {contact.phone}
                </a>
              ) : (
                <span className="wire-text">{contact.phone}</span>
              ))}
            {contact?.email && (
              <a className="wire-text wire-footer__link" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            )}
            {contact?.address && <span className="wire-text">{contact.address}</span>}
            {tgHref && contact?.telegram && (
              <a className="wire-text wire-footer__link" href={tgHref}>
                Telegram
              </a>
            )}
            {igLink && (
              <a className="wire-text wire-footer__link" href={igLink}>
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
            {links.map((l) => (
              <a className="wire-nav__link" href={l.href} key={l.href}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
