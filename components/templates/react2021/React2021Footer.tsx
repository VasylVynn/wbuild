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
 * Footer — CHROME (no block/schema — rendered by React2021Wrapper around
 * every page). Content/link behaviour mirrors AiSaasFooter (real site
 * navigation, a real `contact` block using tel:/mailto:/telegramHref/
 * viberHref), but the layout borrows About.tsx's centred-logo/link-row/
 * social-icon feel and restyles it to the react-2021 dark-ink footer: a
 * `bg-[#1a2e35]` band, white headings, gray-300 body text, and social SVGs
 * that go coral on hover. Prop signature matches AiSaasFooter minus tagline —
 * React2021Wrapper passes exactly { brandName, brandAccent, navLinks, contact }.
 */
export default function React2021Footer({
  brandName = "Studio",
  brandAccent = "AI",
  navLinks = defaultNavLinks,
  contact = defaultContact,
}: {
  brandName?: string;
  brandAccent?: string;
  navLinks?: NavLink[];
  contact?: FooterContact;
}) {
  const year = new Date().getFullYear();
  const telegram = telegramHref(contact.telegram);
  const viber = viberHref(contact.viber);

  const socials = [
    {
      label: "Instagram",
      href: "#",
      icon: (
        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
        </svg>
      ),
    },
    {
      label: "Facebook",
      href: "#",
      icon: (
        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.891h-2.33v6.987C18.343 21.128 22 16.991 22 12z" />
        </svg>
      ),
    },
    {
      label: "X",
      href: "#",
      icon: (
        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="bg-[#1a2e35] text-gray-300" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="text-xl font-extrabold tracking-tight text-white">
              {brandName}
              <span className="text-[#ec4755]">{brandAccent}</span>
            </a>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">
              Сайт, що приводить клієнтів.
            </p>
            <div className="mt-5 flex items-center gap-5">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fill-current text-gray-300 transition-colors hover:text-[#ec4755]"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          <nav aria-label="Навігація">
            <h3 className="mb-4 text-sm font-semibold text-white">Навігація</h3>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  <a href={link.href} className="text-sm text-gray-300 transition-colors hover:text-[#ec4755]">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Контакти</h3>
            <ul className="space-y-2.5">
              {contact.phone && (
                <li>
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="text-sm text-gray-300 transition-colors hover:text-[#ec4755]">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.address && <li className="text-sm text-gray-300">{contact.address}</li>}
              {contact.hours && <li className="text-sm text-gray-300">{contact.hours}</li>}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="text-sm text-gray-300 transition-colors hover:text-[#ec4755]">
                    {contact.email}
                  </a>
                </li>
              )}
              {telegram && (
                <li>
                  <a href={telegram} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 transition-colors hover:text-[#ec4755]">
                    Telegram
                  </a>
                </li>
              )}
              {viber && (
                <li>
                  <a href={viber} className="text-sm text-gray-300 transition-colors hover:text-[#ec4755]">
                    Viber
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-gray-400">
          &copy; {year} {brandName}
          {brandAccent}. Усі права захищені.
        </div>
      </div>
    </footer>
  );
}
