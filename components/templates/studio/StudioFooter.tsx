import { instagramHref, telegramHref, viberHref } from "@/lib/blocks/contact-links";

type NavLink = { href: string; label: string };
type FooterContact = {
  phone?: string;
  address?: string;
  hours?: string;
  email?: string;
  telegram?: string;
  viber?: string;
  instagram?: string;
};

const defaultNavLinks: NavLink[] = [
  { href: "#services", label: "Послуги" },
  { href: "#about", label: "Про нас" },
  { href: "#faq", label: "Питання" },
];

const defaultContact: FooterContact = {
  phone: "+380 67 123 45 67",
  address: "вул. Прикладна, 1, Львів",
  hours: "Пн–Сб 9:00–19:00",
  email: "hello@site.ua",
};

/*
 * Footer — verbatim port of the source Footer: a 3-column grid (brand +
 * tagline, then nav + contact) over a bottom bar with copyright and 3 social
 * icons.
 *
 * Parameterised: the source's hardcoded Product/Resources/Legal SaaS-demo
 * groups are replaced with real site navigation (`navLinks`) and a real
 * `contact` block, both defaulting to UA copy. Social icon hrefs default to
 * '#' — no real social presence on a freshly generated site.
 *
 * Fidelity deltas: server component — the source computed the copyright year
 * client-side via next-intl `t()`; here it's a hardcoded constant so this
 * stays render-on-server with no client boundary. next/link swapped for
 * plain <a> — the source's legal links pointed at real Next.js routes
 * (/imprint, /privacy); ours are anchor placeholders until the generator
 * wires real pages.
 *
 * Bottom-bar social icons: the source's X/GitHub/Telegram trio all defaulted
 * to "#" — dead links, and X/GitHub have no real-data equivalent on a
 * generated business site, so both were dropped. Telegram and the new
 * Instagram icon now reuse the same `telegram`/`instagram` links as the
 * Контакти column and render only when real (telegramHref/instagramHref).
 */
export default function StudioFooter({
  brandName = "Студія",
  brandAccent = "Про",
  tagline = "Сайт, що приводить клієнтів.",
  navLinks = defaultNavLinks,
  contact = defaultContact,
}: {
  brandName?: string;
  brandAccent?: string;
  tagline?: string;
  navLinks?: NavLink[];
  contact?: FooterContact;
}) {
  const year = 2026;
  const telegram = telegramHref(contact.telegram);
  const viber = viberHref(contact.viber);
  const instagram = instagramHref(contact.instagram);

  return (
    <footer className="border-t border-white/5" role="contentinfo">
      <div className="container mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="text-lg font-semibold text-white mb-3 block tracking-tight">
              {brandName}
              <span className="text-zinc-500 font-normal">{brandAccent}</span>
            </a>
            <p className="text-zinc-600 text-sm leading-relaxed">{tagline}</p>
          </div>

          <nav aria-label="Навігація">
            <h3 className="text-sm font-medium text-white mb-4">Навігація</h3>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  <a href={link.href} className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-medium text-white mb-4">Контакти</h3>
            <ul className="space-y-2.5">
              {contact.phone && (
                <li>
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.address && <li className="text-zinc-500 text-sm">{contact.address}</li>}
              {contact.hours && <li className="text-zinc-500 text-sm">{contact.hours}</li>}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                    {contact.email}
                  </a>
                </li>
              )}
              {telegram && (
                <li>
                  <a href={telegram} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                    Telegram
                  </a>
                </li>
              )}
              {viber && (
                <li>
                  <a href={viber} className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
                    Viber
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-zinc-600 text-xs">
            © {year} {brandName}
            {brandAccent}. Усі права захищені.
          </p>
          {(instagram || telegram) && (
            <div className="flex items-center gap-5">
              {instagram && (
                <a href={instagram} className="text-zinc-600 hover:text-zinc-400 transition-colors" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </a>
              )}
              {telegram && (
                <a href={telegram} className="text-zinc-600 hover:text-zinc-400 transition-colors" aria-label="Telegram" target="_blank" rel="noopener noreferrer">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
