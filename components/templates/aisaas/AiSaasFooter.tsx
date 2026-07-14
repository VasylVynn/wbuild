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
  { href: "#gallery", label: "Роботи" },
  { href: "#testimonials", label: "Відгуки" },
  { href: "#faq", label: "Питання" },
];

const defaultContact: FooterContact = {
  phone: "+380 67 123 45 67",
  address: "вул. Прикладна, 1",
  hours: "Пн–Сб 9:00–19:00",
  email: "hello@site.ua",
};

/*
 * Footer — CHROME (no block/schema — rendered by AiSaasWrapper around every
 * page). NO source equivalent for the content (the source footer.tsx is a
 * hardcoded SaaS-demo marketing footer with Product/Resources/Legal groups
 * and a language switcher); only its 3-column-grid-over-bottom-bar shape is
 * kept. Content mirrors components/templates/studio/StudioFooter.tsx: real
 * site navigation, a real `contact` block using the tel:/mailto:/telegramHref/
 * viberHref link behaviour, restyled to the soft-pastel system — a light
 * card-like footer with pastel icon-chip social links.
 */
export default function AiSaasFooter({
  brandName = "Studio",
  brandAccent = "AI",
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

  const socials = [
    {
      label: "Instagram",
      href: "#",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      label: "Facebook",
      href: "#",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 9h3V6h-3a3 3 0 0 0-3 3v2H9v3h2v6h3v-6h3l1-3h-4v-2c0-.6.4-1 1-1Z" />
        </svg>
      ),
    },
    {
      label: "X",
      href: "#",
      icon: (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="border-t border-[#2F4550]/10 bg-white" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="text-xl font-bold tracking-tight text-[#2F4550]">
              {brandName}
              <span className="text-[#E07A5F]">{brandAccent}</span>
            </a>
            <p className="mt-3 text-sm leading-relaxed text-[#2F4550]/70">{tagline}</p>
            <div className="mt-5 flex items-center gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F0FB] text-[#2F4550] transition-colors hover:text-[#E07A5F]"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          <nav aria-label="Навігація">
            <h3 className="mb-4 text-sm font-semibold text-[#2F4550]">Навігація</h3>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  <a href={link.href} className="text-sm text-[#2F4550]/70 transition-colors hover:text-[#E07A5F]">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-[#2F4550]">Контакти</h3>
            <ul className="space-y-2.5">
              {contact.phone && (
                <li>
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="text-sm text-[#2F4550]/70 transition-colors hover:text-[#E07A5F]">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.address && <li className="text-sm text-[#2F4550]/70">{contact.address}</li>}
              {contact.hours && <li className="text-sm text-[#2F4550]/70">{contact.hours}</li>}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="text-sm text-[#2F4550]/70 transition-colors hover:text-[#E07A5F]">
                    {contact.email}
                  </a>
                </li>
              )}
              {telegram && (
                <li>
                  <a href={telegram} target="_blank" rel="noopener noreferrer" className="text-sm text-[#2F4550]/70 transition-colors hover:text-[#E07A5F]">
                    Telegram
                  </a>
                </li>
              )}
              {viber && (
                <li>
                  <a href={viber} className="text-sm text-[#2F4550]/70 transition-colors hover:text-[#E07A5F]">
                    Viber
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[#2F4550]/10 pt-6 text-center text-xs text-[#2F4550]/50">
          © {year} {brandName}
          {brandAccent}. Усі права захищені.
        </div>
      </div>
    </footer>
  );
}
