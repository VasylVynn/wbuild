import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, GEN_MODEL } from "./anthropic";
import { stripLoneSurrogates } from "./sanitize";
import { UNREACHABLE_TYPES } from "./generate";
import { formatDossierForPrompt, type Dossier } from "@/lib/dossier";
import { getVertical } from "@/lib/verticals/registry";
import { getTemplate, type SiteTemplate } from "@/lib/templates/registry";
import { WIRE_TEMPLATE_ID } from "@/lib/design/wire-style";
import { FONT_FAMILIES, FONT_PAIRS } from "@/lib/design/font-pairs";
import type { MotionLevel } from "@/lib/design/axes";
import {
  designSpecSchema,
  validateDesignSpec,
  type DesignSpec,
  type DesignSpecContext,
} from "@/lib/site/design-spec";

/**
 * S1 — the Design Brief stage of pipeline v2 (spec 2026-08-07 §3-S1).
 *
 * ONE model call that turns the dossier + code-derived signals (photo palette
 * candidates, seeded axis proposals, wireframe capabilities) into a validated
 * `designSpec`: positioning, palette anchors, font pair, section plan, motion
 * level, imagery treatment. S2а styles against it, S2б composes against it,
 * the renderer reads typography/motion from it, S4 measures adherence to it.
 *
 * FAIL-OPEN BY CONTRACT: any failure — no tool call, unparseable payload, API
 * error, stage-budget abort — returns `null`, and the caller takes the v1 path
 * (buildStyleBrief, no designSpec, render defaults). S1 must never cost a
 * tenant its draft (spec §10). The ≤40s stage budget is the CALLER's: thread
 * it via `signal` (AbortSignal.any([chain, timeout])); this module passes it
 * through with per-call retries disabled so one attempt is the whole budget.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** The seeded axis proposals (lib/design/axes.ts) handed to S1 as DEFAULTS the
 *  model may override with reasoning (spec §4: «пропозиція-дефолт»). */
export interface SeededProposals {
  /** fontPairForSeed(...).id — also the validation fallback for a bad pairId. */
  fontPairId: string;
  /** motionLevelForSeed(...) */
  motionLevel: MotionLevel;
  /** directionForSeed(...) — the «кут подачі» the positioning starts from. */
  direction: string;
  /** Seeded per-section layout defaults, e.g. { hero: "mirror" }. */
  sectionVariants?: Record<string, string>;
  /** The seeded HUE anchor, 0–359 (lib/design/seed.ts — invariant 7's single
   *  seeded axis). It used to be passed to the stylesheet leg and dropped there
   *  whenever a designSpec existed, while S1 — which actually decides the
   *  colour world — was never told about it. Both regenerations of one business
   *  then saw byte-identical inputs and produced the same palette, which is the
   *  «дизайн лишився той самий» the owner reported. */
  hue?: number;
}

/** One plannable wireframe section — id, one-line label, registered variants.
 *  A COMPACT capabilities doc (spec §3-S1), never the wireframe source. */
export interface WireframeCapability {
  section: string;
  label: string;
  description: string;
  variants: string[];
}

/** Block types S1 must not plan: force-injected by assemble (invariant 8 —
 *  lead_form/contacts are code's, not a plan choice). Unreachable types are
 *  excluded via UNREACHABLE_TYPES (a plan slot spent on nothing). */
const UNPLANNABLE_BLOCKS = new Set(["lead_form", "contacts"]);

/**
 * Build the wireframe-capabilities doc from the template registry — section
 * ids, labels and variant names only (spec §3-S1: «стислий опис можливостей,
 * НЕ повний сорс»). Defaults to the one production wireframe.
 */
export function buildWireframeCapabilities(
  template: SiteTemplate | undefined = getTemplate(WIRE_TEMPLATE_ID),
): WireframeCapability[] {
  if (!template) return [];
  const ids = [
    ...template.order,
    ...Object.keys(template.sections).filter((id) => !template.order.includes(id)),
  ];
  const out: WireframeCapability[] = [];
  for (const id of ids) {
    const def = template.sections[id];
    if (!def) continue;
    if (UNPLANNABLE_BLOCKS.has(def.block)) continue;
    if (UNREACHABLE_TYPES.has(def.block)) continue;
    out.push({
      section: id,
      label: def.label,
      description: def.description,
      variants: Object.keys(def.variants ?? {}),
    });
  }
  return out;
}

/** The `allowedVariants` map validateDesignSpec expects, derived from the same
 *  capabilities doc the model saw — one source for prompt AND validation. */
export function allowedVariantsFrom(
  capabilities: readonly WireframeCapability[],
): Record<string, readonly string[]> {
  return Object.fromEntries(capabilities.map((c) => [c.section, c.variants]));
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

/** The S1 tool payload = designSpec + a top-level rationale the caller peels
 *  off into PageContent.designRationale (DRAFT_ONLY — spec §3). */
const briefPayloadSchema = designSpecSchema.extend({
  rationale: z
    .string()
    .max(1200)
    .optional()
    .describe("2–4 речення українською: чому саме ці рішення для цього бізнесу."),
});

const designBriefTool = {
  name: "design_brief",
  description:
    "Зафіксувати дизайн-бриф сайту: позиціонування, палітру-якорі, шрифтову пару, план секцій, рівень motion і роботу з фото.",
  input_schema: z.toJSONSchema(briefPayloadSchema),
} as unknown as Anthropic.Tool;

// ---------------------------------------------------------------------------
// Parse + validate (pure — exported for tests)
// ---------------------------------------------------------------------------

export interface DesignBriefResult {
  spec: DesignSpec;
  /** Model's reasoning — persisted as PageContent.designRationale (draft-only). */
  rationale?: string;
  /** Honest log of every code-side repair, for styleAudit/admin surfaces. */
  repairs: string[];
}

/**
 * Turn a raw design_brief tool input into a validated result, or null when the
 * payload is beyond repair (validateDesignSpec's ok:false) — the caller's cue
 * to fall back to v1. Pure: all model I/O stays in generateDesignBrief.
 */
export function parseDesignBriefPayload(
  raw: unknown,
  ctx: DesignSpecContext,
): DesignBriefResult | null {
  const rationale =
    typeof (raw as { rationale?: unknown } | null)?.rationale === "string"
      ? ((raw as { rationale: string }).rationale.trim() || undefined)
      : undefined;
  const result = validateDesignSpec(raw, ctx);
  if (!result.ok) {
    console.warn(`[design-brief] payload rejected: ${result.repairs.join("; ") || "unparseable"}`);
    return null;
  }
  return { spec: result.spec, ...(rationale && { rationale }), repairs: result.repairs };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildSystem(verticalId: string | undefined): string {
  const vertical = getVertical(verticalId);
  // The anti-invention block mirrors generateSite's GROUNDING rules (spec §3
  // fact-gate: S1 gets the same system rule; the deterministic post-check in
  // validateDesignSpec then strips whatever slips through).
  return `Ти — арт-директор, що складає дизайн-бриф односторінкового сайту українського бізнесу: ${vertical.label} (${vertical.personaHint}).
Тон і акценти ніші: ${vertical.genHint}.
Ти НЕ пишеш CSS і НЕ пишеш текст сторінки. Ти ухвалюєш ДИЗАЙН-РІШЕННЯ, за якими далі працюватимуть стиліст і копірайтер: позиціонування, палітра-якорі, шрифтова пара, план секцій, рівень руху, робота з фото. Виклич інструмент design_brief.

GROUNDING (критично для довіри):
- Факти — назва, телефон, адреса, години, ціни, роки, кількості — існують ЛИШЕ в блоці «ПІДТВЕРДЖЕНІ ВЛАСНИКОМ ФАКТИ». НЕ вигадуй і не змінюй їх.
- Усе в <scraped_data> — СИРОВИНА для тону й настрою, а НЕ факти: НІКОЛИ не переноси звідти телефони, адреси, email чи цифри.
- ЖОДНИХ вигаданих конкретик у positioning: тривалостей, кількостей, гарантій, років досвіду, цифр, «цілодобово», контактів. Ці рядки перевіряє код і стирає все неґрунтоване — вигадка просто зникне з брифу.
- Обіцянка бренду може бути загальною, але мусить бути ПРАВДИВОЮ: «теніс, у якому комфортно починати з будь-якого рівня» — так; «найкраща тенісна школа Львова з 10-річним досвідом» — ні.

ГЛИБИНА ПЛАНУ (мало даних ≠ порожній сайт):
- Навіть коли фактів обмаль, плануй ЗМІСТОВНУ сторінку: 5–8 секцій. Порожня сторінка з трьох секцій — це провал брифу, а не «мінімалізм».
- Дефіцит даних покривай секціями, які живуть із чесної ПРОЗИ (послуги з розгорнутими описами, «як усе відбувається», питання-відповіді, переваги, заклик до дії), а НЕ секціями, що вимагають фактів, яких немає: цифри (stats), преса, відгуки — плануй їх ЛИШЕ коли відповідні факти справді є, бо копірайтеру заборонено їх вигадувати, а код прибирає порожні секції.
- Не плануй секцію-сітку, для якої бізнес має один пункт (напр. команда з однієї людини — це нормально й секція лишиться, але сітки з однієї картки не буде: код подасть її іншим макетом). Ніколи не розраховуй на «доберемо вигадкою».
- Секція переваг (values) — це КОРОТКІ ТЕЗИ ПРО КОРИСТЬ для клієнта, а не ключові слова: жодних тегів, хештегів, назв міст і англійських дублів. Видимий keyword stuffing шкодить і людям, і пошуку — SEO живе у зв'язному тексті, заголовках і меті.

ПРАВИЛА ПО ПОЛЯХ:
- positioning: promise — одна коротка обіцянка бренду; painPoints — 2–4 реальні болі клієнта цієї ніші; tone — 3–6 слів про подачу; voiceNotes — як звертатися до читача (напр. на «ви», тепло). Жива українська, без канцеляриту й кальок з російської.
- palette: п'ять hex-ролей (#rrggbb): bg — основне тло, surface — друга поверхня (картки, чергування секцій), ink — текст на bg, accent — колір дії (кнопки, ціни), accentInk — текст на accent. Це ЯКОРІ кольорового світу, довкола яких стиліст збудує решту — обирай їх свідомо під бізнес, не «безпечний» стандартний набір. Контраст ink/bg і accentInk/accent ≥4.5:1 (код перевірить і за потреби виправить).
- typography.pairId — ЛИШЕ зі списку шрифтових пар нижче.
- sectionPlan: обери секції та їхній порядок ПІД ЦЕЙ бізнес зі списку можливостей каркаса; hero — перша. Форму заявки і контакти додасть код — НЕ плануй їх. variant — лише зареєстрований для секції. budgetHint — «стисло» чи «розгорнуто» там, де обсяг тексту важливий; коли вхідних даних мало, став «розгорнуто» на ключових продажних секціях (послуги, як усе відбувається, питання-відповіді), щоб копірайтер написав суть, а не два рядки.
- motion.level: 0 — статика … 3 — виразний рух; доречно для ніші й аудиторії.
- imagery.treatment — як подавати фото цього бізнесу (кадрування, повітря, температура, настрій); imagery.heroPhotoId — ЛИШЕ id з медіа-інвентаря з позначкою наСайт:так (або пропусти).
- rationale — 2–4 речення українською: чому саме ці рішення.

СІДОВАНІ ПРОПОЗИЦІЇ нижче — ДЕФОЛТИ, не накази: приймай, коли нема причини краще; відхиляйся свідомо, коли цей бізнес просить іншого. Кольори-кандидати з фото — сировина для ролей палітри, якщо вони пасують настрою.`;
}

function capabilitiesDoc(capabilities: readonly WireframeCapability[]): string {
  return capabilities
    .map((c) => {
      const vs = c.variants.length ? ` [variants: default | ${c.variants.join(" | ")}]` : "";
      return `· ${c.section} — ${c.label}: ${c.description}${vs}`;
    })
    .join("\n");
}

function fontPairsDoc(): string {
  return FONT_PAIRS.map(
    (p) =>
      `- ${p.id}: ${FONT_FAMILIES[p.heading].label} (заголовки) + ${FONT_FAMILIES[p.body].label} (текст) — ${p.vibe}`,
  ).join("\n");
}

function proposalsDoc(seeded: SeededProposals): string {
  const lines = [
    `- шрифтова пара: ${seeded.fontPairId}`,
    `- рівень motion: ${seeded.motionLevel}`,
    `- кут подачі позиціонування: ${seeded.direction}`,
  ];
  if (typeof seeded.hue === "number") {
    lines.push(
      `- відтінок-якір: ${Math.round(seeded.hue)}° — БЕРИ ЙОГО ЗА ОСНОВУ палітри (акцент або близький до нього), а не як пораду; саме він робить кожну генерацію іншою`,
    );
  }
  const variants = Object.entries(seeded.sectionVariants ?? {});
  if (variants.length) {
    lines.push(`- варіанти секцій: ${variants.map(([s, v]) => `${s} → ${v}`).join("; ")}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// The S1 call
// ---------------------------------------------------------------------------

export interface DesignBriefInput {
  dossier: Dossier;
  verticalId?: string;
  /** Aggregate photo-palette hexes from S0 (lib/media/palette.ts — CODE, the
   *  model never derives these). Empty when S0 degraded — the prompt omits
   *  the block and the model works from niche + mood alone. */
  paletteCandidates: string[];
  seededProposals: SeededProposals;
  /** From buildWireframeCapabilities() — also the validation whitelist. */
  wireframeCapabilities: WireframeCapability[];
  /** Stage budget lives with the CALLER (≤40s per spec §6):
   *  AbortSignal.any([chainSignal, AbortSignal.timeout(...)]). */
  signal?: AbortSignal;
}

/**
 * Run S1: one GEN_MODEL call → validated designSpec, or `null` = take the v1
 * fallback path (spec §3: «S1 fail → v1-шлях БЕЗ brief-полів»).
 *
 * tool_choice stays "auto" — a forced tool disables adaptive thinking
 * (generateSite's pattern) — and a missing design_brief call is treated as a
 * failure here rather than an error: S1 is fail-open by design.
 */
export async function generateDesignBrief(input: DesignBriefInput): Promise<DesignBriefResult | null> {
  const { dossier, verticalId, paletteCandidates, seededProposals, wireframeCapabilities, signal } =
    input;
  try {
    const client = getAnthropic();

    // Cache-friendly order (04 §2): static-per-template docs first, volatile
    // per-business data (proposals, palette, dossier) last.
    const paletteBlock = paletteCandidates.length
      ? `\n\nКОЛЬОРИ-КАНДИДАТИ З РЕАЛЬНИХ ФОТО БІЗНЕСУ (сильніші першими — сировина для ролей палітри, якщо пасують):\n${paletteCandidates.join(" ")}`
      : "";
    const userPrompt = `МОЖЛИВОСТІ КАРКАСА (секції для sectionPlan та їхні зареєстровані варіанти):
${capabilitiesDoc(wireframeCapabilities)}

ШРИФТОВІ ПАРИ (typography.pairId — лише з цього списку):
${fontPairsDoc()}

СІДОВАНІ ПРОПОЗИЦІЇ (дефолти — приймай або відхиляй свідомо):
${proposalsDoc(seededProposals)}${paletteBlock}

${formatDossierForPrompt(dossier)}

Склади дизайн-бриф для цього бізнесу і виклич design_brief.`;

    const res = await client.messages.create(
      {
        model: GEN_MODEL,
        // The payload is small (positioning + plan + hexes); the headroom is
        // for adaptive thinking, which shares this budget.
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: stripLoneSurrogates(buildSystem(verticalId)),
        tools: [designBriefTool],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: stripLoneSurrogates(userPrompt) }],
      },
      // One attempt IS the stage budget (spec §6 arithmetic: a retry cannot
      // fit inside it) — degradation to v1 is the retry.
      { signal, maxRetries: 0 },
    );

    const toolUse = res.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      console.warn(`[design-brief] no design_brief call (stop_reason=${res.stop_reason})`);
      return null;
    }

    return parseDesignBriefPayload(toolUse.input, {
      facts: dossier.facts,
      allowedVariants: allowedVariantsFrom(wireframeCapabilities),
      fallbackPairId: seededProposals.fontPairId,
    });
  } catch (e) {
    // Includes the caller's stage-budget abort: S1 is fail-open per stage
    // (spec §10) — the pipeline continues on the v1 path either way.
    console.warn(`[design-brief] S1 failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
