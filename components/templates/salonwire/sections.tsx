import type { BlockProps } from "@/lib/blocks/schema";
import {
  instagramHref,
  normalizeIgHandle,
  normalizeUaPhoneDigits,
  telegramHref,
  viberHref,
} from "@/lib/blocks/contact-links";
import WireLeadFormClient from "./WireLeadForm.client";

/*
 * salonwire sections — the WIREFRAME (design spike, 2026-07-27).
 *
 * Structure only. Every element carries a stable, semantic class from the
 * contract in `wire.css`; there is not a single colour, shadow, radius or
 * animation here, and deliberately no Tailwind utility classes at all — so a
 * generated stylesheet never fights specificity.
 *
 * These components are also the CONTEXT handed to the model: it is shown this
 * file so it styles the real class names rather than guessing them.
 */

/* ── Hero ──────────────────────────────────────────────────────────────────
 *
 * THREE structural layouts of the same hero content (plan §2, wave B). Each is
 * its own component because the registry selects layouts that way
 * (`salonwireSections.hero.variants` — the block's stored `variant` id picks
 * one, PageRenderer resolves it). They differ in markup and ONE modifier class;
 * every layout rule lives in `wire.css`:
 *
 *   .wire-hero                 split  — text left, photo right from lg (default)
 *   .wire-hero--mirror         mirror — the same grid, photo in the LEFT column
 *   .wire-hero--banner         banner — photo as a full-bleed backdrop, text
 *                              centred over it; with no photo it degrades to a
 *                              centred text-only opener
 *   .wire-hero--scrim          on a banner that HAS a photo: the text sits on a
 *                              dark scrim, so it must stay LIGHT
 *
 * The generated stylesheet still owns surface only — it sees this file verbatim
 * (lib/design/wire-style.ts), which is why the modifiers are named, not inline.
 */

function WireHeroContent({ d }: { d: BlockProps["hero"] }) {
  return (
    <>
      {d.eyebrow && <span className="wire-eyebrow">{d.eyebrow}</span>}
      <h1 className="wire-title">{d.title}</h1>
      {d.subtitle && <p className="wire-subtitle">{d.subtitle}</p>}
      <div className="wire-row wire-hero__actions">
        {d.ctaLabel && (
          <a className="wire-btn wire-btn--primary" href={d.ctaHref ?? "#lead_form"}>
            {d.ctaLabel}
          </a>
        )}
        {d.secondaryCtaLabel && (
          <a className="wire-btn wire-btn--ghost" href={d.secondaryCtaHref ?? "#contacts"}>
            {d.secondaryCtaLabel}
          </a>
        )}
      </div>
    </>
  );
}

/** split (default) — text and photo side by side, photo on the right from lg. */
export function WireHero({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];
  return (
    <section className="wire-section wire-hero">
      <div className="wire-container wire-hero__inner">
        <div className="wire-stack wire-hero__body">
          <WireHeroContent d={d} />
        </div>
        {d.imageUrl && (
          <div className="wire-hero__media">
            <img className="wire-media" src={d.imageUrl} alt={d.imageAlt ?? ""} />
          </div>
        )}
      </div>
    </section>
  );
}

/** mirror — identical structure, photo moved to the left column (lg and up).
 *  Mobile still stacks text first: reading order beats symmetry. */
export function WireHeroMirror({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];
  return (
    <section className="wire-section wire-hero wire-hero--mirror">
      <div className="wire-container wire-hero__inner">
        <div className="wire-stack wire-hero__body">
          <WireHeroContent d={d} />
        </div>
        {d.imageUrl && (
          <div className="wire-hero__media">
            <img className="wire-media" src={d.imageUrl} alt={d.imageAlt ?? ""} />
          </div>
        )}
      </div>
    </section>
  );
}

/** banner — the photo becomes the background under a scrim, text centred on
 *  top. Without a photo there is no backdrop and no scrim class, so the same
 *  markup renders as a centred text opener on the section's own surface. */
export function WireHeroBanner({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];
  return (
    <section
      className={`wire-section wire-hero wire-hero--banner${d.imageUrl ? " wire-hero--scrim" : ""}`}
    >
      {d.imageUrl && (
        <div className="wire-hero__backdrop">
          <img className="wire-hero__bg" src={d.imageUrl} alt={d.imageAlt ?? ""} />
          <span className="wire-hero__scrim" aria-hidden="true" />
        </div>
      )}
      <div className="wire-container wire-hero__inner">
        <div className="wire-stack wire-hero__body">
          <WireHeroContent d={d} />
        </div>
      </div>
    </section>
  );
}

/* ── Services ──────────────────────────────────────────────────────────── */

export function WireServices({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];
  return (
    <section className="wire-section wire-services">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title wire-services__title">{d.title}</h2>}
        <div className="wire-grid-3">
          {d.items.map((item, i) => (
            <article className="wire-card wire-service" key={i}>
              <h3 className="wire-heading wire-service__name">{item.name}</h3>
              {item.description && <p className="wire-text wire-service__desc">{item.description}</p>}
              {item.price && <p className="wire-price wire-service__price">{item.price}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Switchback (story) ────────────────────────────────────────────────── */

export function WireSwitchback({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];
  return (
    <section className="wire-section wire-switchback">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        {d.items.map((item, i) => (
          // `--wire-split-order` alternates which side the media sits on. The
          // generated sheet may override it; it may not touch the grid itself.
          <div className="wire-split wire-switchback__row" key={i} style={{ ["--wire-split-order" as string]: i % 2 ? 1 : 0 }}>
            <div className="wire-stack wire-switchback__body">
              <h3 className="wire-heading">{item.heading}</h3>
              <p className="wire-text">{item.body}</p>
              {item.buttonLabel && (
                <a className="wire-btn" href={item.buttonHref ?? "#lead_form"}>
                  {item.buttonLabel}
                </a>
              )}
            </div>
            <div className="wire-split__media">
              <img className="wire-media" src={item.imageUrl} alt={item.heading} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Timeline (process) ────────────────────────────────────────────────── */

export function WireTimeline({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];
  return (
    <section className="wire-section wire-timeline">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <ol className="wire-stack wire-timeline__list">
          {d.items.map((item, i) => (
            <li className="wire-card wire-timeline__step" key={i}>
              <span className="wire-eyebrow wire-timeline__index">{item.period ?? String(i + 1)}</span>
              <h3 className="wire-heading">{item.title}</h3>
              {item.subtitle && <p className="wire-text">{item.subtitle}</p>}
              {item.description && <p className="wire-text">{item.description}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Gallery ───────────────────────────────────────────────────────────── */

export function WireGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];
  const pending = d.pendingImages ?? 0;
  return (
    <section className="wire-section wire-gallery">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-grid-3">
          {d.images.map((img, i) => (
            <figure className="wire-gallery__item" key={i}>
              <img className="wire-media" src={img.url} alt={img.alt ?? ""} />
              {img.title && <figcaption className="wire-text">{img.title}</figcaption>}
            </figure>
          ))}
          {Array.from({ length: pending }).map((_, i) => (
            <div className="wire-media wire-gallery__pending" key={`p${i}`} aria-hidden="true" />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Team ──────────────────────────────────────────────────────────────── */

export function WireTeam({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];
  return (
    <section className="wire-section wire-team">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-grid-4">
          {d.items.map((m, i) => (
            <article className="wire-card wire-member" key={i}>
              {m.photo && <img className="wire-media wire-member__photo" src={m.photo} alt={m.name} />}
              <h3 className="wire-heading">{m.name}</h3>
              {m.role && <p className="wire-eyebrow">{m.role}</p>}
              {m.bio && <p className="wire-text">{m.bio}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ──────────────────────────────────────────────────────── */

export function WireTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];
  return (
    <section className="wire-section wire-testimonials">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-grid-3">
          {d.items.map((t, i) => (
            <blockquote className="wire-card wire-quote" key={i}>
              <p className="wire-text wire-quote__body">{t.quote}</p>
              <footer className="wire-quote__author">
                <span className="wire-heading">{t.author}</span>
                {t.role && <span className="wire-eyebrow">{t.role}</span>}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ───────────────────────────────────────────────────────────────── */

export function WireFaq({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];
  return (
    <section className="wire-section wire-faq">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-faq__list">
          {d.items.map((item, i) => (
            <details className="wire-faq__item" key={i} open={i === 0}>
              <summary className="wire-faq__q">{item.question}</summary>
              <p className="wire-faq__a">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Lead form ─────────────────────────────────────────────────────────── */

export function WireLeadForm({ data }: { data: unknown }) {
  const d = data as BlockProps["lead_form"];
  return (
    <section className="wire-section wire-leadform">
      <div className="wire-container wire-stack wire-leadform__inner">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        {d.subtitle && <p className="wire-subtitle">{d.subtitle}</p>}
        {/* Interactive half lives in the client component — the wireframe's only
            one; it posts to /api/leads (invariant #8: the form must WORK). */}
        <WireLeadFormClient data={d} />
      </div>
    </section>
  );
}

/* ── Stats ─────────────────────────────────────────────────────────────── */

export function WireStats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];
  return (
    <section className="wire-section wire-stats">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-grid-4">
          {d.items.map((s, i) => (
            <div className="wire-stat" key={i}>
              <span className="wire-stat__value">{s.value}</span>
              <span className="wire-stat__label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA ───────────────────────────────────────────────────────────────── */

export function WireCta({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];
  return (
    <section className="wire-section wire-cta">
      <div className="wire-container wire-stack wire-cta__inner">
        <h2 className="wire-title wire-cta__title">{d.title}</h2>
        {d.subtitle && <p className="wire-subtitle wire-cta__subtitle">{d.subtitle}</p>}
        <a className="wire-btn wire-btn--primary" href={d.buttonHref ?? "#lead_form"}>
          {d.buttonLabel}
        </a>
      </div>
    </section>
  );
}

/* ── Marquee (values) ──────────────────────────────────────────────────── */

export function WireMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];
  return (
    <section className="wire-section wire-marquee">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <ul className="wire-row wire-marquee__list">
          {d.items.map((item, i) => (
            <li className="wire-marquee__item" key={i}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Publications (press) ──────────────────────────────────────────────── */

export function WirePublications({ data }: { data: unknown }) {
  const d = data as BlockProps["publications"];
  return (
    <section className="wire-section wire-press">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-grid-3">
          {d.items.map((p, i) => (
            <article className="wire-card wire-press__item" key={i}>
              {p.source && <span className="wire-eyebrow">{p.source}</span>}
              <h3 className="wire-heading">{p.title}</h3>
              {p.subtitle && <p className="wire-text">{p.subtitle}</p>}
              {p.year && <span className="wire-eyebrow wire-press__year">{p.year}</span>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Map ───────────────────────────────────────────────────────────────── */

export function WireMap({ data }: { data: unknown }) {
  const d = data as BlockProps["map"];
  // The VISIBLE address is the owner's confirmed requisite, copied 1:1. The
  // QUERY may be richer — code appends the city, because a bare street name
  // resolves to the wrong town (plan §4.4). Never model-written.
  const query = d.mapQuery?.trim() || d.address;
  return (
    <section className="wire-section wire-map">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <p className="wire-heading wire-map__address">{d.address}</p>
        {/* Geocode-free embed: Google resolves the address string itself, so no
            API key. The footprint keeps wire-map__canvas for the generated sheet. */}
        <iframe
          className="wire-media wire-map__canvas"
          src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
          title={`Карта: ${d.address}`}
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  );
}

/* ── Instagram CTA ─────────────────────────────────────────────────────── */

export function WireInstagramCta({ data }: { data: unknown }) {
  const d = data as BlockProps["instagram_cta"];
  return (
    <section className="wire-section wire-igcta">
      <div className="wire-container wire-stack wire-igcta__inner">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        {d.subtitle && <p className="wire-subtitle">{d.subtitle}</p>}
        <span className="wire-heading wire-igcta__handle">@{d.handle}</span>
        {typeof d.followersCount === "number" && (
          <span className="wire-eyebrow">{d.followersCount} підписників</span>
        )}
        <a className="wire-btn wire-btn--primary" href={`https://instagram.com/${d.handle}`}>
          Написати в Direct
        </a>
      </div>
    </section>
  );
}

/* ── Contacts ──────────────────────────────────────────────────────────── */

export function WireContacts({ data }: { data: unknown }) {
  const d = data as BlockProps["contacts"];
  const phoneDigits = d.phone ? normalizeUaPhoneDigits(d.phone) : "";
  const igHandle = normalizeIgHandle(d.instagram);
  const rows: { label: string; value: string; href?: string }[] = [];
  if (d.phone) rows.push({ label: "Телефон", value: d.phone, href: phoneDigits ? `tel:+${phoneDigits}` : undefined });
  if (d.address) rows.push({ label: "Адреса", value: d.address });
  if (d.hours) rows.push({ label: "Години", value: d.hours });
  if (d.email) rows.push({ label: "Email", value: d.email, href: `mailto:${d.email}` });
  const tg = telegramHref(d.telegram);
  if (d.telegram && tg) rows.push({ label: "Telegram", value: d.telegram, href: tg });
  const vb = viberHref(d.viber);
  if (d.viber && vb) rows.push({ label: "Viber", value: d.viber, href: vb });
  if (igHandle) rows.push({ label: "Instagram", value: `@${igHandle}`, href: instagramHref(igHandle) ?? undefined });
  return (
    <section className="wire-section wire-contacts">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-grid-2">
          {rows.map(({ label, value, href }) => (
            <div className="wire-card wire-contact" key={label}>
              <span className="wire-eyebrow">{label}</span>
              {href ? (
                <a className="wire-heading wire-contact__value wire-contact__link" href={href}>
                  {value}
                </a>
              ) : (
                <span className="wire-heading wire-contact__value">{value}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
