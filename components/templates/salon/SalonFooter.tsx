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

const MapPinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0-.414.336-.75.75-.75h2.086c.361 0 .671.256.738.61l.892 4.673a.75.75 0 01-.336.782l-1.61 1.05a11.25 11.25 0 006.02 6.02l1.05-1.61a.75.75 0 01.782-.336l4.673.892c.354.067.61.377.61.738v2.086a.75.75 0 01-.75.75H18a15.75 15.75 0 01-15.75-15.75V6.75z" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0-.414.336-.75.75-.75h18c.414 0 .75.336.75.75v10.5a.75.75 0 01-.75.75h-18a.75.75 0 01-.75-.75V6.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden="true">
    <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v5l3 2" />
  </svg>
);
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path strokeLinecap="round" d="M16.5 7.5h.008" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.02 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562v1.877h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.92 8.437-9.94z" />
  </svg>
);

/*
 * Footer — port of the source salon Footer: brand blurb + social icons, a
 * real site-navigation column, and a contact column with icon chips, over a
 * bottom bar with copyright + social icons.
 *
 * Parameterised: brand (name + accent word), tagline, real `navLinks`, and
 * a real `contact` block are optional props with UA demo defaults, replacing
 * the source's newsletter signup column (no schema/endpoint for it on a
 * generated site) and its bare phone/address/email props. next/link swapped
 * for plain <a>. Copyright year is a hardcoded 2026 constant, matching the
 * studio footer's server-render-friendly approach.
 */
export default function SalonFooter({
  brandName = "LUXE",
  brandAccent = "Салон",
  tagline = "Мистецтво краси у кожній деталі. Ми створюємо бездоганний вигляд і незабутні враження для кожного клієнта.",
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
    <footer className="relative border-t border-border pt-20 pb-10 overflow-hidden" role="contentinfo">
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-beauty-pink/5 rounded-full blur-3xl pointer-events-none" />

      <div className="section-container relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          <div className="space-y-5">
            <a href="#" className="inline-block font-display text-3xl font-bold text-gradient-aurora">
              {brandName} {brandAccent}
            </a>
            <p className="text-muted-foreground leading-relaxed max-w-xs font-light">{tagline}</p>
          </div>

          <nav aria-label="Навігація" className="space-y-5">
            <h3 className="font-display text-lg font-semibold text-foreground">Навігація</h3>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.href + link.label}>
                  <a href={link.href} className="text-muted-foreground hover:text-accent transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-5">
            <h3 className="font-display text-lg font-semibold text-foreground">Контакти</h3>
            <ul className="space-y-4 text-muted-foreground">
              {contact.address && (
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <MapPinIcon />
                  </div>
                  <span>{contact.address}</span>
                </li>
              )}
              {contact.phone && (
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <PhoneIcon />
                  </div>
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-accent transition-colors">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.hours && (
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <ClockIcon />
                  </div>
                  <span>{contact.hours}</span>
                </li>
              )}
              {contact.email && (
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <MailIcon />
                  </div>
                  <a href={`mailto:${contact.email}`} className="hover:text-accent transition-colors">
                    {contact.email}
                  </a>
                </li>
              )}
              {telegram && (
                <li>
                  <a href={telegram} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                    Telegram
                  </a>
                </li>
              )}
              {viber && (
                <li>
                  <a href={viber} className="hover:text-accent transition-colors">
                    Viber
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-muted-foreground text-sm font-light tracking-wide">
            © {year} {brandName} {brandAccent}. Усі права захищені.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent transition-colors"
              aria-label="Instagram"
            >
              <InstagramIcon />
            </a>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent transition-colors"
              aria-label="Facebook"
            >
              <FacebookIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
