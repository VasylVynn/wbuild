import type { BusinessFacts } from "@/lib/verticals/schema";
import type { SiteMedia, PhotoMeta } from "@/lib/media/media";
import type { Dossier } from "@/lib/dossier";

/**
 * Data-shaped gap detection (owner feedback 2026-08-10, item 6) — the honest
 * middle between the deleted questionnaire and «never ask».
 *
 * W0 (plan 2026-08-07 §0) killed the required-field script: the agent infers
 * what it can and generates first. That stands. What W0 did NOT decide is that
 * the agent must stay silent when the DATA ITSELF shows a hole the site will
 * visibly fall into — a card grid built from one card, a gallery with one tile,
 * a page that never says where the business works.
 *
 * The rule this module encodes is about the SHAPE of the data, never about the
 * niche:
 *
 *   R1 SINGLETON SET — a collection the page renders as a set of cards holds
 *      exactly one member (services / testimonials / photos).
 *   R2 EMPTY SET — the same collection is empty where the page would show it
 *      (no photo at all).
 *   R3 DECISION FACT ABSENT — a fact the buyer's decision needs, where the
 *      NEED is proven by other data we hold, not by the trade: an address with
 *      no hours (people physically come), services with no price anywhere
 *      (the page must stay silent about money), no geography at all.
 *   R4 SOURCE HINT UNCAPTURED — the scraped profile / photo text carries a
 *      hours- / address- / price-shaped signal while the matching fact is
 *      empty: the data says the fact exists, we just do not hold it.
 *
 * There is deliberately NO per-vertical branch here — a rule that needs the
 * niche to fire is a script, and scripts are what W0 removed. The detector is
 * pure and deterministic; it decides WHICH gap is worth a question. The MODEL
 * owns the wording (the notes below are guidance in the system prompt, never
 * shown to the owner verbatim), and nothing here can block generation: the
 * readiness signal is still `start_generation` (businessName + one contact
 * channel), which no gap touches.
 */

export type GapRule =
  | "singleton_set" // R1
  | "empty_set" // R2
  | "decision_fact_absent" // R3
  | "source_hint_uncaptured"; // R4

/** Dedupe key — one gap per subject, highest weight wins. */
export type GapSubject =
  | "services"
  | "testimonials"
  | "photos"
  | "hours"
  | "address"
  | "prices"
  | "geo";

export interface DataGap {
  rule: GapRule;
  subject: GapSubject;
  /** Model-facing Ukrainian guidance — WHY it matters + what to ask. */
  note: string;
  /** How visibly the site suffers if this stays unanswered (higher = worse). */
  weight: number;
}

/** Hard cap on gaps surfaced to the model — the anti-annoyance contract. */
export const MAX_GAPS = 2;
/** Clarifying questions allowed per CONVERSATION (plan §0.1 keeps this at 1–2). */
export const MAX_CLARIFYING_QUESTIONS = 2;

export interface GapInput {
  facts: Partial<BusinessFacts>;
  media?: SiteMedia | null;
  dossier?: Dossier | null;
  /** Chat history (both roles) — owner words feed the text pool + the budget. */
  transcript?: { role: string; content: string }[];
}

// ---------------------------------------------------------------------------
// Text pool — everything the agent already HOLDS about this business, as text:
// the owner's own words, the scraped bio/captions, photo alt/OCR. Used by the
// source-hint rules (R4).
// ---------------------------------------------------------------------------

const MAX_POOL_ITEMS = 60;

function textPool(input: GapInput): string[] {
  const out: string[] = [];
  const facts = input.facts ?? {};
  if (facts.about) out.push(facts.about);
  for (const s of facts.services ?? []) {
    if (s.name) out.push(s.name);
    if (s.description) out.push(s.description);
  }
  const d = input.dossier;
  if (d) {
    if (d.ig.bioRaw) out.push(d.ig.bioRaw);
    if (d.ig.categoryName) out.push(d.ig.categoryName);
    for (const p of d.ig.posts.slice(0, 12)) if (p.captionExcerpt) out.push(p.captionExcerpt);
    for (const m of d.mediaInventory.slice(0, 24)) {
      if (m.alt) out.push(m.alt);
      if (m.ocrExcerpt) out.push(m.ocrExcerpt);
    }
  } else {
    for (const m of (input.media?.photoMeta ?? []).slice(0, 24)) {
      if (m.alt) out.push(m.alt);
      if (m.ocrText) out.push(m.ocrText);
    }
  }
  for (const m of input.transcript ?? []) {
    if (m.role === "user" && m.content?.trim()) out.push(m.content);
  }
  return out.slice(0, MAX_POOL_ITEMS);
}

// ---------------------------------------------------------------------------
// R1 «people» — DELIBERATELY ABSENT (review 2026-08-10).
//
// The first cut inferred people from free text with a given-name gazetteer plus
// a stem-prefix match. Probed against real copy it fired on ordinary nouns and
// verbs — «Ромашки для вашого настрою» → [Ромашки], «Вірю, що кожен клієнт…» →
// [Вірю], «Любов до справи», «Злата осінь» and the street name
// «вул. Владислава Городецького» — while UNDERCOUNTING a
// real team («Анна, Заріна та Аміна» → one name, because only one is in any
// gazetteer). Wrong in both directions is exactly the annoying, wrong question
// the owner banned, and at weight 88 it outranked every honest gap.
//
// A person is not a text pattern. This rule comes back the day the page renders
// people from a STRUCTURED collection — `facts.team` — the same way `services`
// and `testimonials` are counted below, and not before.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Source hints (R4): token classes that mean «this fact exists in the source
// text». Weekday abbreviations, street words and money markers are language
// features, not trade features.
// ---------------------------------------------------------------------------

const HOURS_HINT =
  /(\b\d{1,2}[:.]\d{2}\s*[–—-]\s*\d{1,2}[:.]\d{2}\b)|(\b(пн|вт|ср|чт|пт|сб|нд)\s*[–—-]\s*(пн|вт|ср|чт|пт|сб|нд)\b)|(без вихідних)|(щодня з)/iu;
const ADDRESS_HINT = /(вул\.|вулиц|просп\.|проспект|бульвар|бул\.|площ|провул|шосе|мікрорайон)/iu;
const PRICE_HINT = /(\d[\d\s]{1,6}\s*(грн|₴|uah))|(\bвід\s+\d)/iu;

// ---------------------------------------------------------------------------
// Collection sizes
// ---------------------------------------------------------------------------

const nonEmpty = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

function serviceCount(facts: Partial<BusinessFacts>): number {
  return (facts.services ?? []).filter((s) => nonEmpty(s?.name)).length;
}

function testimonialCount(facts: Partial<BusinessFacts>): number {
  return (facts.testimonials ?? []).filter((t) => nonEmpty(t?.quote)).length;
}

/** Photos that would actually reach the page (role/quality filtering already
 *  happened in the chat tools — `media.photos` IS the site list). */
function sitePhotoCount(media?: SiteMedia | null): number {
  return (media?.photos ?? []).length;
}

/** A place people come to: an address, or a photo classified as premises. */
function hasPlaceSignal(facts: Partial<BusinessFacts>, media?: SiteMedia | null): boolean {
  if (nonEmpty(facts.address)) return true;
  const meta: PhotoMeta[] = media?.photoMeta ?? [];
  return meta.some((m) => m.kind === "interior");
}

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

/**
 * All gaps the data currently shows, strongest first, capped at MAX_GAPS.
 * Pure: same input → same output, no model call, no I/O.
 */
export function detectGaps(input: GapInput): DataGap[] {
  const facts = input.facts ?? {};
  // Nothing to enrich before we even know WHAT the business is — the first
  // turns belong to «tell me about your business», not to enrichment.
  if (!nonEmpty(facts.businessName)) return [];

  const pool = textPool(input);
  const joined = pool.join("\n");
  const gaps: DataGap[] = [];

  // --- R1 singleton sets -------------------------------------------------
  const services = serviceCount(facts);
  if (services === 1) {
    gaps.push({
      rule: "singleton_set",
      subject: "services",
      weight: 82,
      note: "У фактах рівно одна послуга — секція послуг вийде сіткою з однієї картки. Варто одним коротким питанням дізнатися, які ще напрямки роботи є.",
    });
  }

  const photos = sitePhotoCount(input.media);
  if (photos === 1) {
    gaps.push({
      rule: "singleton_set",
      subject: "photos",
      weight: 76,
      note: "Для сайту придатне лише одне фото — галерея буде з однієї плитки. Варто одним коротким питанням запропонувати надіслати ще кілька фото просто в чат.",
    });
  }

  if (testimonialCount(facts) === 1) {
    gaps.push({
      rule: "singleton_set",
      subject: "testimonials",
      weight: 46,
      note: "Зібрано лише один відгук — секція відгуків виглядатиме напівпорожньою. Можна одним коротким питанням дізнатися, чи є ще відгуки клієнтів.",
    });
  }

  // --- R2 empty set ------------------------------------------------------
  if (photos === 0) {
    gaps.push({
      rule: "empty_set",
      subject: "photos",
      weight: 80,
      note: "Жодного фото немає — сайт вийде без реальних знімків, і це найпомітніша втрата. Варто одним коротким питанням запропонувати надіслати кілька фото просто в чат.",
    });
  }

  // --- R3 decision facts, needed because of OTHER data we hold -----------
  if (!nonEmpty(facts.city) && !nonEmpty(facts.address)) {
    gaps.push({
      rule: "decision_fact_absent",
      subject: "geo",
      weight: 70,
      note: "Немає ні міста, ні адреси — сайт не зможе сказати, де ви працюєте (це важливо і для клієнта, і для пошуку). Варто одним коротким питанням дізнатися місто або район роботи.",
    });
  }

  if (hasPlaceSignal(facts, input.media) && !nonEmpty(facts.hours)) {
    gaps.push({
      rule: "decision_fact_absent",
      subject: "hours",
      weight: 62,
      note: "Є фізичне місце (адреса чи фото приміщення), але немає годин роботи — саме вони вирішують, чи людина поїде. Варто одним коротким питанням дізнатися графік.",
    });
  }

  if (services >= 1 && (facts.services ?? []).every((s) => !nonEmpty(s?.price))) {
    gaps.push({
      rule: "decision_fact_absent",
      subject: "prices",
      weight: 54,
      note: "У жодної послуги немає ціни — сайт мовчатиме про вартість, а вигадувати ціни не можна. Варто одним коротким питанням дізнатися хоча б орієнтир «від», з правом пропустити.",
    });
  }

  // --- R4 the source text names a fact we do not hold --------------------
  if (!nonEmpty(facts.hours) && HOURS_HINT.test(joined)) {
    gaps.push({
      rule: "source_hint_uncaptured",
      subject: "hours",
      weight: 58,
      note: "У зібраних даних (біо, підписи, текст на фото) трапляється схоже на графік роботи, але у фактах годин немає. Варто одним коротким питанням звірити години.",
    });
  }

  if (!nonEmpty(facts.address) && ADDRESS_HINT.test(joined)) {
    gaps.push({
      rule: "source_hint_uncaptured",
      subject: "address",
      weight: 56,
      note: "У зібраних даних трапляється схоже на адресу, але у фактах адреси немає. Варто одним коротким питанням звірити адресу.",
    });
  }

  if ((facts.services ?? []).every((s) => !nonEmpty(s?.price)) && PRICE_HINT.test(joined)) {
    gaps.push({
      rule: "source_hint_uncaptured",
      subject: "prices",
      weight: 50,
      note: "У зібраних даних трапляються суми, але жодної ціни у фактах немає. Варто одним коротким питанням звірити, які ціни показувати.",
    });
  }

  // One gap per subject (strongest wins), deterministic order, hard cap.
  const bySubject = new Map<GapSubject, DataGap>();
  for (const g of gaps) {
    const prev = bySubject.get(g.subject);
    if (!prev || g.weight > prev.weight) bySubject.set(g.subject, g);
  }
  return [...bySubject.values()]
    .sort((a, b) => b.weight - a.weight || a.subject.localeCompare(b.subject))
    .slice(0, MAX_GAPS);
}

// ---------------------------------------------------------------------------
// Turn-level budget: WHEN the agent is still allowed to ask.
// ---------------------------------------------------------------------------

/** Question sentences that are the generate PROPOSAL («Створюємо сайт?»), not a
 *  clarification — they must not eat the clarification budget. */
const PROPOSAL_QUESTION = /(створ|генер|поїхал|почина|запуска|готов)/iu;

/** Confirmation, not clarification: «Все вірно?» re-reads what we already hold
 *  and costs the owner nothing to answer. */
const CONFIRMATION_QUESTION = /(вірно|правильно|все так|нічого не змін)/iu;

/**
 * Cues that a question is ABOUT one of the gap subjects — mirroring the rules
 * above (photos / geo / hours / services / prices / testimonials). Data-shaped,
 * never niche-shaped, like every other pattern in this module.
 */
const GAP_QUESTION_CUES: RegExp[] = [
  /фото|світлин|знімк/iu, // photos
  /(?<!\p{L})де(?!\p{L})|міст|адрес|район|локац/iu, // geo / address
  /годин|графік|розклад|коли\s+(ви\s+)?прац/iu, // hours
  /послуг|напрям/iu, // services
  /цін|вартіст|скільки\s+кошт/iu, // prices
  /відгук/iu, // testimonials
];

/**
 * How many GAP-DRIVEN clarifying questions the owner has already been asked in
 * this conversation. The transcript is the only state a stateless turn has, so
 * the count is reconstructed from the agent's own text — but it must count the
 * MECHANISM, not prose:
 *  - sentence-split first, so a statement clause («Створюю сайт із того, що
 *    маю. Є ще тренери?») cannot absolve the question clause beside it — the
 *    old split-on-«?» let one proposal keyword cancel a real ask;
 *  - a question only counts when it names a gap subject: the agent's ordinary
 *    opening questions («Як з вами звʼязатись?», «Все вірно?») used to spend
 *    the whole 2-question budget before `businessName` even existed, and the
 *    gap mechanism then never fired once;
 *  - at most ONE per assistant message: two «?» in a single turn is one
 *    interruption, and the budget is about interruptions.
 */
export function countAgentQuestions(transcript?: { role: string; content: string }[]): number {
  let n = 0;
  for (const m of transcript ?? []) {
    if (m.role !== "assistant" || !m.content) continue;
    for (const sentence of m.content.split(/(?<=[.!?…])\s+/u)) {
      if (!sentence.includes("?")) continue;
      if (PROPOSAL_QUESTION.test(sentence)) continue;
      if (CONFIRMATION_QUESTION.test(sentence)) continue;
      if (!GAP_QUESTION_CUES.some((re) => re.test(sentence))) continue;
      n += 1;
      break; // one interruption per message, however many «?» it carries
    }
  }
  return n;
}

/** «Just do it» — unambiguous wherever it appears in the message. */
const SKIP_STRONG =
  /(пропуст|скіп|байдуже|неважливо|не важливо|просто (зроб|створ|генер|роби)|давай вже|роби вже|нема часу|немає часу)/iu;
/** Ambiguous as a substring: «спочатку теніс, потім ще щось» and «не знаю, як
 *  краще» are not «stop asking». Only a SHORT message that essentially IS the
 *  signal counts. */
const SKIP_WEAK = /(не знаю|потім|згодом)/iu;
/** Explicit agreement to generate. The turn the owner says «Створюй сайт» is
 *  the turn the model must call start_generation, not the turn it asks one more
 *  question: `accum.status` is still "collecting" while the prompt is built, so
 *  this is the only guard that fires in time.
 *  Two shapes, both deliberately narrow — «так, Львів» is an ANSWER, not a go:
 *   - a generate verb opening the message (covers the app's own quick-reply
 *     chip «Створюй сайт», hardcoded in lib/ai/onboard.ts);
 *   - a message that is NOTHING BUT assent words. */
const AGREEMENT_GENERATE = /^(створюй(те)?|створіть|генеруй(те)?)(?!\p{L})/iu;
const AGREEMENT_ASSENT =
  /^((так|ок|окей|добре|давай(те)?|го|згоден|згодна|поїхали|погнали|звісно|звичайно)[\s,!.…]*)+$/iu;

export function ownerSignalsSkip(transcript?: { role: string; content: string }[]): boolean {
  const lastUser = [...(transcript ?? [])].reverse().find((m) => m.role === "user" && m.content?.trim());
  if (!lastUser) return false;
  const text = lastUser.content.trim();
  if (SKIP_STRONG.test(text)) return true;
  if (AGREEMENT_GENERATE.test(text) || AGREEMENT_ASSENT.test(text)) return true;
  return text.length <= 40 && SKIP_WEAK.test(text);
}

/**
 * Gaps worth a question ON THIS TURN — `detectGaps` filtered by the
 * anti-annoyance budget. Returns [] (and the prompt then carries no gap block)
 * when the owner already agreed to generate, signalled «just do it», or has
 * already been asked MAX_CLARIFYING_QUESTIONS times.
 */
export function selectGaps(
  input: GapInput & { status?: "collecting" | "ready" | "confirmed" },
): DataGap[] {
  if (input.status === "confirmed") return [];
  if (ownerSignalsSkip(input.transcript)) return [];
  const budget = MAX_CLARIFYING_QUESTIONS - countAgentQuestions(input.transcript);
  if (budget <= 0) return [];
  return detectGaps(input).slice(0, Math.min(budget, MAX_GAPS));
}
