import { z } from "zod";
import { converter, formatHex, parse as parseColor, wcagContrast, type Oklch } from "culori";
import { DEFAULT_FONT_PAIR_ID, getFontPair } from "@/lib/design/font-pairs";

/**
 * The designSpec contract — the S1 Design Brief artifact of pipeline v2 (spec
 * 2026-08-07 §3-S1). One brief per generation: S2а styles against its palette
 * anchors, S2б composes against its sectionPlan, S3 persists it into
 * PageContent, the renderer reads typography/motion from it, S4 measures
 * adherence to it. Everything imports THIS module; nothing re-declares the
 * shape.
 *
 * The zod schema validates the MODEL's tool-use output; `validateDesignSpec`
 * is the code-side repair layer on top (spec §3 «Валідація S1 кодом»):
 * pairId ∈ whitelist, variant ∈ registry, palette contrast repair, and the
 * FACT-GATE (invariant 5) that strips positioning strings carrying numerals,
 * dates, durations or contact-shaped tokens absent from confirmed facts.
 *
 * No "server-only" here on purpose: the render path and plain-node vitest both
 * import it.
 */

// ---------------------------------------------------------------------------
// Schema + types
// ---------------------------------------------------------------------------

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected #rrggbb");

export const designSpecSchema = z.object({
  /** The story the site leads with — marketing wrapper copy, fact-gated. */
  positioning: z.object({
    promise: z.string().max(300),
    painPoints: z.array(z.string().max(300)).max(8),
    tone: z.string().max(200),
    voiceNotes: z.string().max(500).optional(),
  }),
  /** hex ANCHORS, not a dictate — S2а builds around these roles (spec §3);
   *  final color authority stays model CSS → fixContrast. */
  palette: z.object({
    bg: hexColor,
    surface: hexColor,
    ink: hexColor,
    accent: hexColor,
    accentInk: hexColor,
  }),
  /** enum over the FONT_PAIRS whitelist — enforced in code, not by zod, so an
   *  out-of-list id degrades to the seeded proposal instead of failing S1. */
  typography: z.object({ pairId: z.string() }),
  /** MANDATORY composition plan for S2б (spec §3): section ids + registered
   *  variants. S3's reconcile writes the POST-injection truth back here. */
  sectionPlan: z
    .array(
      z.object({
        section: z.string(),
        variant: z.string().optional(),
        /** Free-form length hint («стисло», «розгорнуто») — consumed by the
         *  S3 charBudget clamps, never by zod .max (overshoot must not drop
         *  a block). */
        budgetHint: z.string().max(80).optional(),
      }),
    )
    .min(1)
    .max(16),
  motion: z.object({
    level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    notes: z.string().max(300).optional(),
  }),
  imagery: z.object({
    /** How photos are treated (crop/duotone/frame language) — a direction for
     *  S2а, not a URL. Models never see photo URLs (invariant 1). */
    treatment: z.string().max(300),
    heroPhotoId: z.string().optional(),
  }),
});

export type DesignSpec = z.infer<typeof designSpecSchema>;
export type DesignPalette = DesignSpec["palette"];
export type SectionPlanEntry = DesignSpec["sectionPlan"][number];

// ---------------------------------------------------------------------------
// Fact gate (invariant 5) — pure, exported for tests
// ---------------------------------------------------------------------------

/** Normalized views of the confirmed facts a claim may be grounded in. */
export interface FactsCorpus {
  /** Lowercased fact strings with spaces/dashes/parens removed. */
  normalized: string[];
  /** Every maximal digit run appearing anywhere in the facts. */
  digitRuns: Set<string>;
  /** Digits-only rendering of each fact string — matches a phone regardless
   *  of formatting («+38 (067) 123-45-67» ⊇ «067 123 45 67»). */
  digitStrings: string[];
}

function normalizeFactText(s: string): string {
  return s.toLowerCase().replace(/[\s\-–—()]/g, "");
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (typeof value === "object" && value !== null)
    for (const v of Object.values(value)) collectStrings(v, out);
}

/** Build the grounding corpus from untyped confirmed facts (tenants.facts). */
export function buildFactsCorpus(facts: unknown): FactsCorpus {
  const strings: string[] = [];
  collectStrings(facts, strings);
  const digitRuns = new Set<string>();
  for (const s of strings) for (const run of s.match(/\d+/g) ?? []) digitRuns.add(run);
  return {
    normalized: strings.map(normalizeFactText),
    digitRuns,
    digitStrings: strings.map((s) => s.replace(/\D/g, "")).filter((s) => s.length > 0),
  };
}

export interface FactGateHit {
  token: string;
  reason: "contact" | "numeral" | "duration";
}

/** Contact-shaped tokens: phone numbers, @handles, e-mails, bare URLs. */
const CONTACT_RE =
  /\+?\d[\d\s\-().]{7,}\d|@[a-z0-9_.]{3,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:https?:\/\/|www\.)\S+/gi;

/** Digit-free duration/availability claims the digit scan cannot catch. The
 *  spec names «цілодобово» (§3); digit-carrying ones («24/7», «10 років»,
 *  dates) all fall to the numeral rule. */
const DURATION_WORDS = ["цілодобово"] as const;

/**
 * Ungrounded-claim scan for ONE candidate string (spec §3 fact-gate) — pure so
 * it can be tested exhaustively. A token is grounded when the confirmed facts
 * contain it (digits compared format-free); anything risky and ungrounded is a
 * hit, and the CALLER strips the whole string — we never rewrite copy
 * mid-sentence.
 */
export function findUngroundedClaims(text: string, corpus: FactsCorpus): FactGateHit[] {
  const hits: FactGateHit[] = [];
  const consumed: Array<[number, number]> = [];

  for (const m of text.matchAll(CONTACT_RE)) {
    consumed.push([m.index, m.index + m[0].length]);
    const digits = m[0].replace(/\D/g, "");
    const grounded =
      digits.length > 0
        ? corpus.digitStrings.some((d) => d.includes(digits))
        : corpus.normalized.some((n) => n.includes(normalizeFactText(m[0])));
    if (!grounded) hits.push({ token: m[0], reason: "contact" });
  }

  for (const m of text.matchAll(/\d+/g)) {
    const inContact = consumed.some(([a, b]) => m.index >= a && m.index < b);
    if (inContact) continue;
    const run = m[0];
    // Exact-run match only: digit-substring containment is for CONTACT tokens
    // (format-free phone matching) — for bare numerals it would ground almost
    // any small number inside the phone's digits. Erring toward stripping is
    // the safe direction for invariant 5.
    if (!corpus.digitRuns.has(run)) hits.push({ token: run, reason: "numeral" });
  }

  const lower = text.toLowerCase();
  for (const word of DURATION_WORDS) {
    if (lower.includes(word) && !corpus.normalized.some((n) => n.includes(word))) {
      hits.push({ token: word, reason: "duration" });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Palette contrast repair — deterministic, exported for tests
// ---------------------------------------------------------------------------

const MIN_RATIO = 4.5;
const toOklch = converter("oklch");
/** Chroma budget, spent only when lightness alone can't reach 4.5:1 — same
 *  ladder as css-contrast's repairTextColor, kept in lockstep by review. */
const CHROMA_STEPS = [1, 0.75, 0.5, 0.25, 0];

/** Move an ink role's OKLCH lightness away from its surface until ≥4.5:1,
 *  giving chroma away only when the full lightness range fails (mirrors
 *  lib/design/css-contrast.ts). Ratios are scored on the serialized hex —
 *  the clipped color is what the visitor sees. Deterministic. */
function repairInkOn(inkHex: string, bgHex: string): string {
  if (wcagContrast(inkHex, bgHex) >= MIN_RATIO) return inkHex;
  const ink = toOklch(parseColor(inkHex)!)!;
  const bgL = toOklch(parseColor(bgHex)!)!.l;
  const step = bgL > 0.5 ? -0.05 : 0.05; // away from the background
  for (const factor of CHROMA_STEPS) {
    const candidate: Oklch = { ...ink, c: ink.c * factor };
    for (let i = 0; i <= 20; i++) {
      const hex = formatHex(candidate);
      if (wcagContrast(hex, bgHex) >= MIN_RATIO) return hex;
      candidate.l = Math.min(1, Math.max(0, candidate.l + step));
    }
  }
  return bgL > 0.5 ? "#000000" : "#ffffff";
}

/**
 * Enforce the two readability contracts of the anchor palette — ink-on-bg and
 * accentInk-on-accent ≥4.5:1 — by moving the INK role only (roles are anchors;
 * repainting bg/accent would change the design, spec §3). Pure + deterministic:
 * the same palette always repairs to the same hexes. All hexes come back
 * lowercased.
 */
export function repairPaletteContrast(palette: DesignPalette): {
  palette: DesignPalette;
  repairs: string[];
} {
  const out: DesignPalette = {
    bg: palette.bg.toLowerCase(),
    surface: palette.surface.toLowerCase(),
    ink: palette.ink.toLowerCase(),
    accent: palette.accent.toLowerCase(),
    accentInk: palette.accentInk.toLowerCase(),
  };
  const repairs: string[] = [];
  for (const [inkRole, bgRole] of [
    ["ink", "bg"],
    ["accentInk", "accent"],
  ] as const) {
    const before = out[inkRole];
    const after = repairInkOn(before, out[bgRole]);
    if (after !== before) {
      repairs.push(
        `palette: ${inkRole} on ${bgRole} ${wcagContrast(before, out[bgRole]).toFixed(1)}:1 → ${before} → ${after}`,
      );
      out[inkRole] = after;
    }
  }
  return { palette: out, repairs };
}

// ---------------------------------------------------------------------------
// validateDesignSpec — the code-side S1 gate
// ---------------------------------------------------------------------------

export interface DesignSpecContext {
  /** Confirmed facts (tenants.facts) — the ONLY grounding for numeric/contact
   *  claims in positioning copy (invariant 5). */
  facts: unknown;
  /** section id → registered variant ids, from the template registry. A
   *  section absent from this map is unknown and its plan entry is dropped. */
  allowedVariants: Record<string, readonly string[]>;
  /** The seeded font-pair proposal (lib/design/axes.ts) — the repair target
   *  for an out-of-whitelist pairId. */
  fallbackPairId: string;
}

export type DesignSpecValidation =
  | { ok: true; spec: DesignSpec; repairs: string[] }
  | { ok: false; repairs: string[] };

/**
 * Validate + repair a raw S1 tool-use payload. Repair-first (fail-open per
 * stage, spec §10): only an unparseable payload or a plan with zero known
 * sections returns `ok: false` — the caller then takes the v1 buildStyleBrief
 * path and renders on `designSpec === undefined`. Every repair is logged
 * honestly for the styleAudit/admin surface.
 */
export function validateDesignSpec(raw: unknown, ctx: DesignSpecContext): DesignSpecValidation {
  const parsed = designSpecSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      repairs: parsed.error.issues.map((i) => `schema ${i.path.join(".")}: ${i.message}`),
    };
  }
  const spec = structuredClone(parsed.data);
  const repairs: string[] = [];

  // pairId ∈ whitelist, else the seeded proposal, else the render default.
  if (!getFontPair(spec.typography.pairId)) {
    const fallback = getFontPair(ctx.fallbackPairId)?.id ?? DEFAULT_FONT_PAIR_ID;
    repairs.push(`typography: pairId "${spec.typography.pairId}" not in whitelist → ${fallback}`);
    spec.typography.pairId = fallback;
  }

  // sectionPlan: unknown sections drop, unregistered variants degrade to the
  // section default. (Force-injected sections — lead_form, contacts — are
  // legitimately absent here; S3's reconcile writes the post-injection truth.)
  spec.sectionPlan = spec.sectionPlan.filter((entry) => {
    const allowed = ctx.allowedVariants[entry.section];
    if (!allowed) {
      repairs.push(`sectionPlan: unknown section "${entry.section}" dropped`);
      return false;
    }
    if (entry.variant !== undefined && !allowed.includes(entry.variant)) {
      repairs.push(
        `sectionPlan: ${entry.section} variant "${entry.variant}" not registered → default`,
      );
      delete entry.variant;
    }
    return true;
  });
  if (spec.sectionPlan.length === 0) {
    return { ok: false, repairs: [...repairs, "sectionPlan: no known sections left"] };
  }

  // Palette: deterministic role repair, ink moves only.
  const paletteResult = repairPaletteContrast(spec.palette);
  spec.palette = paletteResult.palette;
  repairs.push(...paletteResult.repairs);

  // Fact gate: strip whole strings, never rewrite copy mid-sentence.
  const corpus = buildFactsCorpus(ctx.facts);
  const gate = (label: string, text: string): boolean => {
    const hits = findUngroundedClaims(text, corpus);
    if (hits.length === 0) return true;
    repairs.push(
      `fact-gate: ${label} stripped (${hits.map((h) => `${h.reason} «${h.token}»`).join(", ")})`,
    );
    return false;
  };
  if (!gate("positioning.promise", spec.positioning.promise)) spec.positioning.promise = "";
  spec.positioning.painPoints = spec.positioning.painPoints.filter((p, i) =>
    gate(`positioning.painPoints[${i}]`, p),
  );
  if (spec.positioning.voiceNotes !== undefined && !gate("positioning.voiceNotes", spec.positioning.voiceNotes)) {
    delete spec.positioning.voiceNotes;
  }

  return { ok: true, spec, repairs };
}
