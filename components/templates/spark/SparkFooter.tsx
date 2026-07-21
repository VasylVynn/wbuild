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
  { href: "#gallery", label: "Роботи" },
  { href: "#testimonials", label: "Відгуки" },
  { href: "#faq", label: "Питання" },
];

const defaultContact: FooterContact = {
  phone: "+380 67 123 45 67",
  address: "вул. Прикладна, 1, Київ",
  hours: "Пн–Пт 9:00–18:00",
  email: "hello@spark.ua",
};

/*
 * Footer — CHROME (no block/schema — rendered by SparkWrapper around every
 * page). A quiet three-column band (mono wordmark + tagline / «Навігація» /
 * «Контакти») over a hairline top border. Prop signature matches TemplateBrand.
 * Instagram is the ONLY social, and only when contact.instagram resolves to a
 * real profile (instagramHref) — no dead `#` links.
 */
export default function SparkFooter({
  brandName = "Spark",
  brandAccent = "Studio",
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
  const linkClass = "text-sm text-[var(--spark-muted-fg)] transition-colors hover:text-[var(--spark-fg)]";

  return (
    <footer className="border-t border-[var(--spark-border)] bg-[var(--spark-bg)] text-[var(--spark-fg)]" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="spark-mono text-base font-medium tracking-tight">
              {brandName}
              <span className="text-[var(--spark-muted-fg)]">{brandAccent}</span>
            </a>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--spark-muted-fg)]">
              Чисті сучасні рішення для вашого бізнесу.
            </p>
            {instagram && (
              <div className="mt-5 flex items-center gap-3">
                <a
                  href={instagram}
                  aria-label="Instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--spark-border)] text-[var(--spark-muted-fg)] transition-colors hover:text-[var(--spark-fg)]"
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
            <h3 className="spark-mono mb-4 text-xs uppercase tracking-wide text-[var(--spark-muted-fg)]">Навігація</h3>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  <a href={link.href} className={linkClass}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="spark-mono mb-4 text-xs uppercase tracking-wide text-[var(--spark-muted-fg)]">Контакти</h3>
            <ul className="space-y-2.5">
              {contact.phone && (
                <li>
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className={linkClass}>
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.address && <li className="text-sm text-[var(--spark-muted-fg)]">{contact.address}</li>}
              {contact.hours && <li className="text-sm text-[var(--spark-muted-fg)]">{contact.hours}</li>}
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
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--spark-border)] pt-6 text-center text-xs text-[var(--spark-muted-fg)]">
          © {year} {brandName}
          {brandAccent}. Усі права захищені.
        </div>
      </div>
    </footer>
  );
}
