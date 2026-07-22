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
  { href: "#gallery", label: "Галерея" },
  { href: "#testimonials", label: "Відгуки" },
  { href: "#faq", label: "Питання" },
];

const defaultContact: FooterContact = {
  phone: "+380 67 123 45 67",
  address: "вул. Хрещатик, 10",
  hours: "Щодня 10:00–20:00",
  email: "hello@launch.ua",
};

/*
 * Footer — CHROME (no block/schema — rendered by LaunchWrapper around every
 * page). Same prop signature as the other templates' footers ({ brandName?,
 * brandAccent?, navLinks?, contact? } — matching TemplateBrand) with the same
 * three-column structure (бренд + Instagram / «Навігація» / «Контакти») and
 * contact-field rendering (tel:/mailto:/telegramHref/viberHref). Instagram only
 * renders when contact.instagram resolves to a real profile (instagramHref) —
 * no dead `#` socials. Restyled to the Launch glass look; a top glow ties it to
 * the hero.
 */
export default function LaunchFooter({
  brandName = "Launch",
  brandAccent = "",
  navLinks = defaultNavLinks,
  contact = defaultContact,
}: {
  brandName?: string;
  brandAccent?: string;
  navLinks?: NavLink[];
  contact?: FooterContact;
}) {
  const year = 2026;
  const telegram = telegramHref(contact.telegram);
  const viber = viberHref(contact.viber);
  const instagram = instagramHref(contact.instagram);

  return (
    <footer className="relative overflow-hidden border-t border-[var(--launch-border)] bg-[var(--launch-bg)] text-[var(--launch-muted)]" role="contentinfo">
      <div className="launch-glow launch-glow--bottom" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="text-xl font-bold tracking-tight text-[var(--launch-fg)]" style={{ fontFamily: "var(--launch-display)" }}>
              {brandName}
              {brandAccent && <span className="text-[var(--launch-brand)]">{brandAccent}</span>}
            </a>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--launch-muted)]">
              Сучасний сайт, що перетворює відвідувачів на клієнтів.
            </p>
            {instagram && (
              <div className="mt-5 flex items-center gap-3">
                <a
                  href={instagram}
                  aria-label="Instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--launch-border)] bg-[var(--launch-input)] text-[var(--launch-muted)] transition-colors hover:border-[var(--launch-brand)] hover:text-[var(--launch-brand)]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </a>
              </div>
            )}
          </div>

          <nav aria-label="Навігація">
            <h3 className="mb-4 text-sm font-semibold text-[var(--launch-fg)]">Навігація</h3>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  <a href={link.href} className="text-sm text-[var(--launch-muted)] transition-colors hover:text-[var(--launch-brand)]">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-[var(--launch-fg)]">Контакти</h3>
            <ul className="space-y-2.5">
              {contact.phone && (
                <li>
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="text-sm text-[var(--launch-muted)] transition-colors hover:text-[var(--launch-brand)]">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.address && <li className="text-sm text-[var(--launch-muted)]">{contact.address}</li>}
              {contact.hours && <li className="text-sm text-[var(--launch-muted)]">{contact.hours}</li>}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="text-sm text-[var(--launch-muted)] transition-colors hover:text-[var(--launch-brand)]">
                    {contact.email}
                  </a>
                </li>
              )}
              {telegram && (
                <li>
                  <a href={telegram} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--launch-muted)] transition-colors hover:text-[var(--launch-brand)]">
                    Telegram
                  </a>
                </li>
              )}
              {viber && (
                <li>
                  <a href={viber} className="text-sm text-[var(--launch-muted)] transition-colors hover:text-[var(--launch-brand)]">
                    Viber
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--launch-border)] pt-6 text-center text-xs text-[var(--launch-muted)]">
          © {year} {brandName}
          {brandAccent}. Усі права захищені.
        </div>
      </div>
    </footer>
  );
}
