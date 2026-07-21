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
  { href: "#timeline", label: "Як проходить візит" },
  { href: "#testimonials", label: "Відгуки" },
  { href: "#faq", label: "Питання" },
];

const defaultContact: FooterContact = {
  phone: "+380 67 123 45 67",
  address: "вул. Хрещатик, 10, Київ",
  hours: "Пн–Сб: 9:00–20:00",
  email: "hello@beleza.ua",
};

/*
 * Footer — CHROME (no block/schema — rendered by BelezaWrapper around every
 * page). Same prop signature as the other templates' footers ({ brandName?,
 * brandAccent?, navLinks?, contact? } — matching TemplateBrand). A soft light
 * band on the warm canvas with a rose logo mark, a three-column layout
 * (бренд + Instagram / навігація / контакти) and the source's own «Графік
 * роботи» block. Instagram is the only social and renders ONLY when
 * contact.instagram resolves to a real profile (no dead `#` links).
 */
export default function BelezaFooter({
  brandName = "Белеза",
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
  const linkClass =
    "beleza-muted text-sm transition-colors hover:text-[color:var(--beleza-branding)]";

  return (
    <footer className="border-t" style={{ borderColor: "var(--beleza-border-subtle)" }} role="contentinfo">
      <div className="beleza-container py-14 md:py-16">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div className="flex max-w-xs flex-col items-start gap-4">
            <a href="/" aria-label={brandName} className="inline-flex items-center gap-2">
              <span className="beleza-chip !h-8 !w-8 !rounded-lg" aria-hidden="true">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c1.6 3 1.6 6 0 9m0 0c-1.6 3-1.6 6 0 9m0-9c3-1.6 6-1.6 9 0m-18 0c3-1.6 6-1.6 9 0" />
                </svg>
              </span>
              <span className="beleza-ink text-base font-bold tracking-tight" style={{ fontFamily: "var(--beleza-display)" }}>
                {brandName}
                {brandAccent && <span className="beleza-accent">{brandAccent}</span>}
              </span>
            </a>
            <p className="beleza-muted text-sm leading-relaxed">
              Простір краси й турботи про себе. Ніжна естетика в кожній деталі.
            </p>
            {instagram && (
              <a
                href={instagram}
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
                className="beleza-chip !h-9 !w-9 transition-colors hover:brightness-95"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
            )}
          </div>

          <nav aria-label="Навігація" className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-2">
            <div className="flex flex-col gap-3.5">
              <span className="beleza-ink text-xs font-semibold uppercase tracking-widest">Розділи</span>
              <ul className="flex flex-col gap-2.5">
                {navLinks.map((link) => (
                  <li key={link.href + link.label}>
                    <a href={link.href} className={linkClass}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3.5">
              <span className="beleza-ink text-xs font-semibold uppercase tracking-widest">Контакти</span>
              <ul className="flex flex-col gap-2.5">
                {contact.phone && (
                  <li>
                    <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className={linkClass}>
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.address && <li className="beleza-muted text-sm">{contact.address}</li>}
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className={linkClass}>
                      {contact.email}
                    </a>
                  </li>
                )}
                {telegram && (
                  <li>
                    <a href={telegram} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      Telegram
                    </a>
                  </li>
                )}
                {viber && (
                  <li>
                    <a href={viber} className={linkClass}>
                      Viber
                    </a>
                  </li>
                )}
                {contact.hours && <li className="beleza-muted text-sm">{contact.hours}</li>}
              </ul>
            </div>
          </nav>
        </div>

        <div
          className="mt-12 flex flex-col-reverse items-start gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--beleza-border-subtle)" }}
        >
          <p className="beleza-muted text-xs">
            © {year} {brandName}
            {brandAccent}. Усі права захищені.
          </p>
          <p className="beleza-muted text-xs">Зроблено з любовʼю до краси.</p>
        </div>
      </div>
    </footer>
  );
}
