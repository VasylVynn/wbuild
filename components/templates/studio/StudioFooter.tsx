import { telegramHref, viberHref } from "@/lib/blocks/contact-links";

type NavLink = { href: string; label: string };
type FooterContact = {
  phone?: string;
  address?: string;
  hours?: string;
  email?: string;
  telegram?: string;
  viber?: string;
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
          <div className="flex items-center gap-5">
            <a href="#" className="text-zinc-600 hover:text-zinc-400 transition-colors" aria-label="X / Twitter" target="_blank" rel="noopener noreferrer">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="#" className="text-zinc-600 hover:text-zinc-400 transition-colors" aria-label="GitHub" target="_blank" rel="noopener noreferrer">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
            <a href="#" className="text-zinc-600 hover:text-zinc-400 transition-colors" aria-label="Telegram" target="_blank" rel="noopener noreferrer">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
