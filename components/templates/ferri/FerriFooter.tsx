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
 * Footer — chrome, not a block. Port of the source ferri Footer's 3-column
 * layout (template_sources/ferri-schoedl-main/src/components/Footer.tsx):
 * brand + tagline + social icons, a real site-navigation column, and a
 * contact column, over a bottom copyright bar. siteConfig/areasDeAtuacao's
 * SaaS-demo link groups are replaced with real `navLinks`/`contact` props
 * (UA defaults). lucide's MapPin/Phone/Mail/Clock are inlined as tiny SVGs.
 * The source's LinkedIn/Instagram/Facebook glyphs all defaulted to "#" —
 * dead links. LinkedIn/Facebook have no real-data equivalent and were
 * dropped; Instagram now renders only when `contact.instagram` resolves to
 * a real profile (instagramHref). Year is a hardcoded constant — no client
 * boundary needed for a static footer.
 */
export default function FerriFooter({
  brandName = "Студія",
  brandAccent = "Право",
  tagline = "Індивідуальний підхід та бездоганна якість у кожній деталі.",
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
    <footer className="border-t border-gold-500/8 bg-navy-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 py-12 sm:gap-12 sm:py-16 md:grid-cols-3">
          {/* Brand column */}
          <div>
            <a href="/" className="font-[family-name:var(--ferri-display)] text-xl tracking-wide text-cream-100">
              {brandName} <span className="text-gold-500">{brandAccent}</span>
            </a>
            <p className="mt-3 text-sm leading-relaxed text-txt-muted">{tagline}</p>

            {/* Social links */}
            {instagram && (
              <div className="mt-5 flex items-center gap-3">
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center border border-gold-500/15 text-txt-muted transition-all duration-300 hover:border-gold-500/40 hover:text-gold-500"
                  aria-label="Instagram"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </a>
              </div>
            )}
          </div>

          {/* Navigation column */}
          <nav aria-label="Навігація">
            <h4 className="mb-4 text-xs font-medium uppercase tracking-[2px] text-gold-500">Навігація</h4>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  <a href={link.href} className="text-sm text-txt-muted transition-colors hover:text-cream-100">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact column */}
          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-[2px] text-gold-500">Контакти</h4>
            <ul className="space-y-3.5">
              {contact.address && (
                <li className="flex gap-3">
                  <svg className="mt-1 h-3.5 w-3.5 shrink-0 text-gold-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="text-sm leading-relaxed text-txt-muted">{contact.address}</span>
                </li>
              )}
              {contact.phone && (
                <li className="flex items-center gap-3">
                  <svg className="h-3.5 w-3.5 shrink-0 text-gold-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="text-sm text-txt-muted transition-colors hover:text-cream-100">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.hours && (
                <li className="flex items-center gap-3">
                  <svg className="h-3.5 w-3.5 shrink-0 text-gold-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  <span className="text-sm leading-relaxed text-txt-muted">{contact.hours}</span>
                </li>
              )}
              {contact.email && (
                <li className="flex items-center gap-3">
                  <svg className="h-3.5 w-3.5 shrink-0 text-gold-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect width="20" height="16" x="2" y="4" />
                    <path d="m2 4 10 8 10-8" />
                  </svg>
                  <a href={`mailto:${contact.email}`} className="text-sm text-txt-muted transition-colors hover:text-cream-100">
                    {contact.email}
                  </a>
                </li>
              )}
              {telegram && (
                <li>
                  <a href={telegram} target="_blank" rel="noopener noreferrer" className="text-sm text-txt-muted transition-colors hover:text-cream-100">
                    Telegram
                  </a>
                </li>
              )}
              {viber && (
                <li>
                  <a href={viber} className="text-sm text-txt-muted transition-colors hover:text-cream-100">
                    Viber
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-gold-500/8 py-6 sm:flex-row">
          <p className="text-xs text-txt-muted">
            © {year} {brandName} {brandAccent}. Усі права захищені.
          </p>
        </div>
      </div>
    </footer>
  );
}
