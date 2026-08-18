import type { CSSProperties } from "react";
import type { BlockProps } from "@/lib/blocks/schema";
import { cleanBenefitStrip, displayFollowers, meetsItemFloor } from "@/lib/blocks/hygiene";
import {
  igDirectHref,
  instagramHref,
  mailtoHref,
  normalizeIgHandle,
  normalizeUaPhoneDigits,
  telegramHref,
  telegramLabel,
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
 *
 * VARIANTS (pipeline v2 §5). Several sections ship alternate LAYOUTS of the
 * same block content — each layout is its own component (the registry in
 * index.ts maps the block's stored `variant` id to it) and differs from the
 * default by markup plus ONE modifier class named `wire-<section>--<variant>`:
 *
 *   services      grid (default) · wire-services--list-rows · wire-services--cards-with-photo
 *   gallery       grid (default) · wire-gallery--masonry-2col · wire-gallery--stream
 *   testimonials  cards (default) · wire-testimonials--big-quote · wire-testimonials--strip
 *   process       list (default) · wire-process--numbered-cards
 *   cta           band (default) · wire-cta--centered-card · wire-cta--full-bleed
 *
 * Every layout rule for a modifier lives in wire.css (LOCKED); the generated
 * stylesheet styles a modifier like any other surface hook and never
 * re-arranges its grid.
 *
 * ONE-ITEM SECTIONS: any of these grids can legitimately receive a single item
 * (one coach, one service, one review). wire.css degrades that case — the lone
 * card spans the row at a readable measure instead of sitting at 1/3 width —
 * so a section never LOOKS broken for having little content. Style the single
 * card exactly like the others; do not write a special case for it.
 *
 * The nav/footer silhouette modifiers
 * (wire-nav--centered-brand, wire-footer--2col, wire-footer--single) live in
 * SalonWireWrapper.tsx — they are seeded per site, not model-chosen.
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

/**
 * CROP ANCHOR for the hero photo (owner feedback 2026-08-10: a portrait photo
 * of a person was cover-cropped through the face on the desktop banner).
 *
 * Contract — `--wire-hero-focus`, consumed by wire.css on BOTH the banner
 * backdrop and the split/mirror photo:
 *   - value: any CSS `object-position` (e.g. "62% 24%", "left top"); default
 *     50% 38% when absent,
 *   - carrier: an inline custom property on the hero <section>, so it inherits
 *     to whichever <img> the layout renders,
 *   - source: `hero.imageFocus` — a registry field (heroSchema) written by CODE
 *     in assemble() from the chosen photo's PhotoMeta (`kind: "person"` →
 *     biased up, `subjectCentered` → dead centre; see heroFocusFor in
 *     lib/ai/generate.ts), NEVER a model choice and never a URL. The model's
 *     value is discarded at conversion, and the editor never shows the field
 *     (CODE_OWNED_KEYS in lib/blocks/fields.ts).
 * Re-validated here rather than trusted: anything that is not a plain position
 * value falls back to the default instead of reaching the stylesheet. There is
 * no saliency box yet — the two metadata signals above are all that is honest,
 * and a hero whose photo carries neither simply uses the default anchor.
 */
const HERO_FOCUS_RE = /^[a-z0-9%.\s-]{1,32}$/i;

function heroFocusStyle(d: BlockProps["hero"]): CSSProperties | undefined {
  const raw = d.imageFocus;
  if (typeof raw !== "string") return undefined;
  const focus = raw.trim();
  if (!focus || !HERO_FOCUS_RE.test(focus)) return undefined;
  return { ["--wire-hero-focus" as string]: focus };
}

function WireHeroContent({ d }: { d: BlockProps["hero"] }) {
  return (
    <>
      {d.eyebrow && <span className="wire-eyebrow">{d.eyebrow}</span>}
      {/* titleAccent is the headline's CONTINUATION (schema contract: an
          accent tail on its own line) — the wireframe silently dropped it
          since the 07-27 migration, shipping truncated h1s like «…та
          авторська» (mood-bakery-2, 2026-08-18). */}
      <h1 className="wire-title">
        {d.title}
        {d.titleAccent && (
          <>
            {" "}
            <span className="wire-title__accent">{d.titleAccent}</span>
          </>
        )}
      </h1>
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
    <section className="wire-section wire-hero" style={heroFocusStyle(d)}>
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
    <section className="wire-section wire-hero wire-hero--mirror" style={heroFocusStyle(d)}>
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
      // The crop anchor matters most here: the backdrop is the widest, shortest
      // box on the page, so it is where `cover` throws away the most photo.
      style={heroFocusStyle(d)}
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

/* ── Services — three layouts (grid / list-rows / cards-with-photo) ────── */

/** grid (default) — the card grid: name, description, price. */
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

/** list-rows — the same cards re-flowed as compact horizontal rows (a price
 *  list): name and description share the line, the price sits at the right
 *  edge. On narrow screens the row simply wraps. */
export function WireServicesList({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];
  return (
    <section className="wire-section wire-services wire-services--list-rows">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title wire-services__title">{d.title}</h2>}
        <div className="wire-services__list">
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

/** cards-with-photo — the card grid with an optional photo atop each card
 *  (`items[].imageUrl`, cast by code from a photoId — never model-invented,
 *  invariant §4.8). A card WITHOUT a photo renders exactly like the default
 *  grid card: the photo slot collapses, it is not a grey hole. */
export function WireServicesPhoto({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];
  return (
    <section className="wire-section wire-services wire-services--cards-with-photo">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title wire-services__title">{d.title}</h2>}
        <div className="wire-grid-3">
          {d.items.map((item, i) => (
            <article className="wire-card wire-service" key={i}>
              {item.imageUrl && (
                <img className="wire-media wire-service__photo" src={item.imageUrl} alt={item.name} />
              )}
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

/* ── Timeline (process) — two layouts (list / numbered-cards) ──────────── */

/** The step index is a BADGE (.wire-badge in wire.css: a fixed round box that
 *  cannot stretch), so it may only hold a short token — an ordinal, or a
 *  `period` of at most three characters («1», «01», «24»). Anything longer
 *  («Крок 1», «2–3 дні», «Січень 2024») is a label, not a counter: it renders
 *  as its own `.wire-timeline__period` line and the badge falls back to the
 *  ordinal. Without this split a long period would widen the badge into a
 *  lozenge across the card — the shape the round-badge geometry exists to
 *  prevent. */
const TIMELINE_BADGE_MAX = 3;

function timelineStepLabels(period: string | undefined, i: number) {
  const trimmed = period?.trim();
  const short = trimmed && trimmed.length <= TIMELINE_BADGE_MAX ? trimmed : undefined;
  return { badge: short ?? String(i + 1), period: short ? undefined : trimmed || undefined };
}

/** list (default) — the vertical numbered list of step cards. */
export function WireTimeline({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];
  return (
    <section className="wire-section wire-timeline">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <ol className="wire-stack wire-timeline__list">
          {d.items.map((item, i) => {
            const step = timelineStepLabels(item.period, i);
            return (
              <li className="wire-card wire-timeline__step" key={i}>
                <span className="wire-badge wire-timeline__index">{step.badge}</span>
                {step.period && <span className="wire-eyebrow wire-timeline__period">{step.period}</span>}
                <h3 className="wire-heading">{item.title}</h3>
                {item.subtitle && <p className="wire-text">{item.subtitle}</p>}
                {item.description && <p className="wire-text">{item.description}</p>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** numbered-cards — the same steps side by side in a grid, each card led by
 *  its large step number (the .wire-timeline__index badge grows in wire.css). */
export function WireTimelineCards({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];
  return (
    <section className="wire-section wire-timeline wire-process--numbered-cards">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <ol className="wire-grid-3 wire-timeline__list">
          {d.items.map((item, i) => {
            const step = timelineStepLabels(item.period, i);
            return (
              <li className="wire-card wire-timeline__step" key={i}>
                <span className="wire-badge wire-timeline__index">{step.badge}</span>
                {step.period && <span className="wire-eyebrow wire-timeline__period">{step.period}</span>}
                <h3 className="wire-heading">{item.title}</h3>
                {item.subtitle && <p className="wire-text">{item.subtitle}</p>}
                {item.description && <p className="wire-text">{item.description}</p>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ── Gallery — three layouts (grid / masonry-2col / stream) ────────────── */

/** grid (default) — the uniform 3-column grid, photos cropped to 4:3. */
export function WireGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];
  const pending = d.pendingImages ?? 0;
  // A gallery with nothing to show renders NOTHING — not a bare heading over
  // an empty grid. This is the floor the pipeline's «resolve to an empty
  // gallery, which the renderer hides» comment always assumed (only the
  // legacy blocks/Gallery ever had it; pre-deploy review 2026-08-18).
  if (d.images.length + pending === 0) return null;
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

/** masonry-2col — TWO EXPLICIT COLUMNS, not CSS multicol. A deterministic
 *  per-item aspect-ratio rotation in wire.css (4:3 base / 3:4 / 1:1) makes the
 *  columns interlock like a mood board while every image keeps a reserved box
 *  (the <img> carries no width/height attributes, so releasing the crop would
 *  collapse the section until photos load). Pending placeholders keep 4:3.
 *
 *  WHY THE SPLIT IS MARKUP: the closing edge has to be level, and CSS multicol
 *  cannot address «the last item of each column» — every tail selector there
 *  lands on the last items of the SAME column. Rendering the columns makes
 *  `.wire-gallery__col > :last-child` real, and wire.css lets it absorb its own
 *  column's slack. Split is column-major (first half, second half), which is
 *  the reading order multicol had.
 *
 *  THE RENDER FLOOR: under four items there is no mood board to build, so it
 *  falls back to the plain grid. An odd count is fine now — the leveling no
 *  longer depends on ending on a pair. */
const MASONRY_MIN_ITEMS = 4;

export function WireGalleryMasonry({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];
  const pending = d.pendingImages ?? 0;
  const total = d.images.length + pending;
  if (total < MASONRY_MIN_ITEMS) return <WireGallery data={data} />;
  const items = [
    ...d.images.map((img, i) => (
      <figure className="wire-gallery__item" key={`i${i}`}>
        <img className="wire-media" src={img.url} alt={img.alt ?? ""} />
        {img.title && <figcaption className="wire-text">{img.title}</figcaption>}
      </figure>
    )),
    ...Array.from({ length: pending }).map((_, i) => (
      <div className="wire-media wire-gallery__pending" key={`p${i}`} aria-hidden="true" />
    )),
  ];
  const half = Math.ceil(items.length / 2);
  return (
    <section className="wire-section wire-gallery wire-gallery--masonry-2col">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-gallery__masonry">
          <div className="wire-gallery__col">{items.slice(0, half)}</div>
          <div className="wire-gallery__col">{items.slice(half)}</div>
        </div>
      </div>
    </section>
  );
}

/** stream — a horizontal, touch-friendly scroll strip with scroll-snap. Pure
 *  CSS: no JS, no buttons; the strip scrolls inside its own overflow so the
 *  page never gains a horizontal scrollbar. */
export function WireGalleryStream({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];
  const pending = d.pendingImages ?? 0;
  // Same empty floor as WireGallery (Masonry funnels through WireGallery).
  if (d.images.length + pending === 0) return null;
  return (
    <section className="wire-section wire-gallery wire-gallery--stream">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-gallery__stream">
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

/** The team card grid. A ONE-person team is a normal case for a small
 *  business, and wire.css makes that single card span the row at a readable
 *  measure rather than stand at a quarter width beside three empty columns. */
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

/* ── Testimonials — three layouts (cards / big-quote / strip) ──────────── */

/** cards (default) — the grid of quote cards. */
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

/** big-quote — the FIRST testimonial becomes one large statement quote set
 *  directly on the section surface (no card); any remaining testimonials
 *  follow as the usual small cards. Static — nothing rotates. */
export function WireTestimonialsBigQuote({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];
  const [lead, ...rest] = d.items;
  return (
    <section className="wire-section wire-testimonials wire-testimonials--big-quote">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        {lead && (
          <blockquote className="wire-quote wire-quote--lead">
            <p className="wire-text wire-quote__body">{lead.quote}</p>
            <footer className="wire-quote__author">
              <span className="wire-heading">{lead.author}</span>
              {lead.role && <span className="wire-eyebrow">{lead.role}</span>}
            </footer>
          </blockquote>
        )}
        {rest.length > 0 && (
          <div className="wire-grid-3">
            {rest.map((t, i) => (
              <blockquote className="wire-card wire-quote" key={i}>
                <p className="wire-text wire-quote__body">{t.quote}</p>
                <footer className="wire-quote__author">
                  <span className="wire-heading">{t.author}</span>
                  {t.role && <span className="wire-eyebrow">{t.role}</span>}
                </footer>
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** strip — the quote cards in one horizontal scroll-snap strip (touch-first,
 *  no JS); the strip scrolls inside its own overflow, never the page. */
export function WireTestimonialsStrip({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];
  return (
    <section className="wire-section wire-testimonials wire-testimonials--strip">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-testimonials__strip">
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

/** The ONE disclosure marker, shipped as markup rather than CSS.
 *
 *  It is inline SVG and not a `::before` glyph because the generated sheet
 *  demonstrably overwrites `content:` (a live site had `content: "\2022"` on
 *  `.wire-faq__q::before`, printing a bullet next to the browser's own ▶); not
 *  a CSS mask because a mask needs `url()`, which css-lint polices, for no
 *  gain. Markup is the only place the stylist cannot reach.
 *
 *  It still takes each site's palette for free: `1em` box, `currentColor`
 *  stroke — the chevron inherits the question's size and colour, so there is
 *  no icon token to invent and no per-site asset. wire.css hides the native
 *  ::marker, rotates this on `[open]` and eases that rotation at motion levels
 *  1–3. `aria-hidden` + `focusable="false"`: the state is already announced by
 *  the native <summary> (aria-expanded), so a second announcement would be
 *  noise, and the icon must never take a tab stop. */
function WireDisclosureIcon() {
  return (
    <svg
      className="wire-faq__icon"
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Native <details>/<summary>: the built-in aria-expanded, Enter/Space toggle
 *  and in-page find all come free, and the answer stays in the DOM for search
 *  engines. The first item opens so the section never reads as an empty list
 *  of headings. */
export function WireFaq({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];
  return (
    <section className="wire-section wire-faq">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <div className="wire-faq__list">
          {d.items.map((item, i) => (
            <details className="wire-faq__item" key={i} open={i === 0}>
              <summary className="wire-faq__q">
                <span className="wire-faq__qtext">{item.question}</span>
                <WireDisclosureIcon />
              </summary>
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
            one; it posts to /api/leads (invariant #8: the form must WORK).
            Its markup is NOT in this file, so style it through the classes the
            Form section of wire.css documents: .wire-leadform__form (locked
            measure + grid — never re-flow it), .wire-field, .wire-field__label,
            .wire-input, .wire-textarea. The submit button is a plain
            .wire-btn.wire-btn--primary. */}
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

/* ── CTA — three layouts (band / centered-card / full-bleed) ───────────── */

/** band (default) — the classic full-width CTA band, content stacked. */
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

/** centered-card — the CTA content sits in ONE centred card on the section
 *  surface; the card (.wire-cta__card) is the natural accent surface. */
export function WireCtaCard({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];
  return (
    <section className="wire-section wire-cta wire-cta--centered-card">
      <div className="wire-container">
        <div className="wire-card wire-stack wire-cta__card">
          <h2 className="wire-title wire-cta__title">{d.title}</h2>
          {d.subtitle && <p className="wire-subtitle wire-cta__subtitle">{d.subtitle}</p>}
          <a className="wire-btn wire-btn--primary" href={d.buttonHref ?? "#lead_form"}>
            {d.buttonLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

/** full-bleed — the WIDTH-axis variant: the container cap is lifted so the
 *  band runs edge to edge (content keeps the page padding), copy left and
 *  button right on one line; on narrow screens the button wraps below. */
export function WireCtaFullBleed({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];
  return (
    <section className="wire-section wire-cta wire-cta--full-bleed">
      <div className="wire-container wire-cta__inner">
        <div className="wire-stack wire-cta__copy">
          <h2 className="wire-title wire-cta__title">{d.title}</h2>
          {d.subtitle && <p className="wire-subtitle wire-cta__subtitle">{d.subtitle}</p>}
        </div>
        <a className="wire-btn wire-btn--primary" href={d.buttonHref ?? "#lead_form"}>
          {d.buttonLabel}
        </a>
      </div>
    </section>
  );
}

/* ── Marquee (values) ──────────────────────────────────────────────────── */

/**
 * RENDER-SIDE keyword guard. The generation-time cleanup (assemble → S3) only
 * ever runs on a NEW page, so every tenant generated before it — including the
 * live site the owner complained about — still stores «Теніс · Tennis ·
 * Тенісльвів · Львів …» in published_content. There is no migrate script in
 * this repo (migrations are applied by hand), so the honest fix for existing
 * sites is to apply the SAME pure function at read time and render nothing when
 * what survives is not a benefits row. The city is not available here, so the
 * city-chip rule sits out; the hashtag / latin-duplicate / concatenation /
 * all-bare-words rules do the work. A regeneration cleans the DATA; this keeps
 * the PAGE clean in the meantime.
 */
export function WireMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];
  const items = cleanBenefitStrip(d.items);
  if (!meetsItemFloor("marquee", items.length)) return null;
  return (
    <section className="wire-section wire-marquee">
      <div className="wire-container wire-stack">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        <ul className="wire-row wire-marquee__list">
          {items.map((item, i) => (
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
  // The stored handle is a grounded FACT, but freeform history means it can
  // arrive as "@name" or as a full profile URL. Normalize before it touches a
  // template literal — a raw "https://www.instagram.com/x" interpolated into
  // `https://instagram.com/${…}` shipped a 404 button AND printed a 451px
  // unbreakable token as body text that scrolled the whole 390px page sideways
  // (live audit 2026-08-10).
  //
  // Nothing usable → NO section at all. A Direct button is a conversion
  // promise; a broken one is worse than an absent one.
  const handle = normalizeIgHandle(d.handle);
  const direct = igDirectHref(handle);
  if (!handle || !direct) return null;
  // The count is social proof only above a floor — below it, it argues against
  // clicking (lib/blocks/hygiene.ts owns the threshold and the plural forms).
  const followers = displayFollowers(d.followersCount);
  return (
    <section className="wire-section wire-igcta">
      <div className="wire-container wire-stack wire-igcta__inner">
        {d.title && <h2 className="wire-title">{d.title}</h2>}
        {d.subtitle && <p className="wire-subtitle">{d.subtitle}</p>}
        {/* Identity, not a link: the handle is who the business IS. Exactly one
            clickable thing lives in this section and it is the button below —
            a printed URL is machine output, never copy. */}
        <p className="wire-igcta__identity">
          <span className="wire-heading wire-igcta__handle">@{handle}</span>
          {followers && <span className="wire-text wire-igcta__followers">{followers}</span>}
        </p>
        {/* Label is CODE's, never the model's: it names the destination, and the
            destination is ig.me/m (Direct), not the profile feed. */}
        <a
          className="wire-btn wire-btn--primary wire-igcta__btn"
          href={direct}
          target="_blank"
          rel="noopener"
        >
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
  // Value stays the owner's own text (1:1); only the HREF is the extracted
  // address, so «пошта: hello@example.com» links correctly instead of building
  // "mailto:пошта: hello@example.com". No address found → plain text, no link.
  if (d.email) rows.push({ label: "Email", value: d.email, href: mailtoHref(d.email) ?? undefined });
  const tg = telegramHref(d.telegram);
  // Never print the raw fact: it may be a full t.me URL. Display the canonical
  // "@username" (or the owner's own text when it is a phone-style deep link).
  if (d.telegram && tg) {
    rows.push({ label: "Telegram", value: telegramLabel(d.telegram) ?? d.telegram, href: tg });
  }
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
