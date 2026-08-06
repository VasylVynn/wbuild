import "server-only";
import { stripLoneSurrogates } from "@/lib/ai/sanitize";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, GEN_MODEL } from "./anthropic";
import {
  heroSchema,
  richTextSchema,
  switchbackSchema,
  servicesSchema,
  statsSchema,
  testimonialsSchema,
  faqSchema,
  ctaSchema,
  leadFormSchema,
  contactsSchema,
  teamSchema,
  timelineSchema,
  marqueeSchema,
  publicationsSchema,
  mapSchema,
  instagramCtaSchema,
  sectionField,
  variantField,
  type BlockInstance,
  type BlockPlacement,
  type BlockType,
  type StoredBlock,
} from "@/lib/blocks/schema";
import { blockLibrary, COMPOSITION_RULES } from "@/lib/blocks/library";
import { getTemplate, type SiteTemplate } from "@/lib/templates/registry";
import { WIRE_TEMPLATE_ID } from "@/lib/design/wire-style";
import { getVertical } from "@/lib/verticals/registry";
import type { VerticalConfig } from "@/lib/verticals/types";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";
import { photoIdFor, type PhotoMeta, type SiteMedia } from "@/lib/media/media";
import { isStorageUrl } from "@/lib/media/media";
import { isEligiblePhoto, photoScore, pickHeroUrl, USABLE_SITE_QUALITY } from "@/lib/media/rank";
import { formatDossierForPrompt, type Dossier } from "@/lib/dossier";
import {
  normalizeUaPhoneDigits,
  normalizeIgHandle,
  instagramHref,
  telegramHref,
  viberHref,
} from "@/lib/blocks/contact-links";

/**
 * Phase 2 — AI composition (brief §4.1–4.4), rebuilt on the Business Dossier
 * (refactor 03 §2.2): the model reads the FULL dossier (facts + brand-voice
 * cues + IG bio/captions + per-photo text inventory + the owner's own words),
 * not a compressed facts object, and composes a page from the block library via
 * TOOL USE. Photos are cast BY ID (03 §2.1 — §4.8 amended: the model sees
 * per-photo TEXT metadata and stable ids, never URLs or pixels); assemble()
 * maps id→storage URL deterministically. Composition rules, grounding, and nav
 * placement are enforced in code afterwards.
 */

// ---------------------------------------------------------------------------
// GENERATION-side block union (photo casting by id, 03 §2.1). Differs from the
// STORED blockInstanceSchema in exactly two arms: hero gains `photoId` and
// loses the url fields; gallery items are `{photoId, title?, category?}`
// instead of `{url, alt, …}`. Everything else reuses the registry prop schemas
// verbatim, so the two unions cannot drift on content fields.
// ---------------------------------------------------------------------------
const genHeroSchema = heroSchema.omit({ imageUrl: true, imageAlt: true }).extend({
  photoId: z
    .string()
    .optional()
    .describe("id фото з медіа-інвентаря (наСайт:так) для фону hero; пропусти, якщо фото немає"),
});

const genGalleryImageSchema = z.object({
  photoId: z.string().describe("id фото з медіа-інвентаря (наСайт:так)"),
  title: z
    .string()
    .optional()
    .describe("Короткий підпис фото на основі РЕАЛЬНОГО підпису/опису — не вигадуй, чого не видно"),
  category: z.string().optional().describe("Коротка категорія фото (напр. «Стрижки»), якщо доречно"),
});
const genGallerySchema = z.object({
  title: z.string().optional(),
  images: z.array(genGalleryImageSchema).min(1),
});

const genBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), props: genHeroSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("richText"), props: richTextSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("switchback"), props: switchbackSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("services"), props: servicesSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("gallery"), props: genGallerySchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("stats"), props: statsSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("testimonials"), props: testimonialsSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("faq"), props: faqSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("cta"), props: ctaSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("lead_form"), props: leadFormSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("contacts"), props: contactsSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("team"), props: teamSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("timeline"), props: timelineSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("marquee"), props: marqueeSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("publications"), props: publicationsSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("map"), props: mapSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("instagram_cta"), props: instagramCtaSchema, section: sectionField, variant: variantField }),
]);
type GenBlockInstance = z.infer<typeof genBlockSchema>;

const generationSchema = z.object({
  // There is one structural wireframe, and a second call writes the site's
  // stylesheet — so the model has no palette to choose and no template to pick.
  // What it decides here is the composition: which blocks, in what order, with
  // what copy.
  blocks: z.array(genBlockSchema),
  // Atmospheric hero-image subject proposed by the model FOR THIS business —
  // consumed by generateHeroImage (§4.8 suffix + palette are appended in code,
  // so the honesty bounds never depend on the model remembering them).
  imageSubject: z.string().max(140).optional(),
  // D1: model-written SEO meta for the home page. Target lengths (≤60/≤150)
  // live in the prompt, NOT as zod caps — a few chars of overshoot must not
  // fail the whole generation; clampSeo() truncates deterministically instead.
  seo: z
    .object({
      title: z
        .string()
        .describe("SEO-title сторінки: «{головна послуга} у {місто} — {назва}», до 60 символів."),
      description: z
        .string()
        .describe("SEO-опис: продаюча суть бізнесу з містом і нішею, до 150 символів, без лапок."),
    })
    .optional(),
});

// Hard ceilings for the persisted SEO meta (search engines truncate anyway);
// generous vs the prompt's 60/150 so a slight model overshoot survives intact.
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MAX = 170;

function clampSeo(
  seo: { title: string; description: string } | undefined,
): { title?: string; description?: string } | undefined {
  if (!seo) return undefined;
  const title = seo.title.trim().slice(0, SEO_TITLE_MAX).trim();
  const description = seo.description.trim().slice(0, SEO_DESCRIPTION_MAX).trim();
  if (!title && !description) return undefined;
  return { ...(title && { title }), ...(description && { description }) };
}

export interface GeneratedSite {
  blocks: StoredBlock[];
  // Always the wireframe; kept on the shape because the render path and the
  // editor still resolve a template to get its section components.
  templateId: string;
  imageSubject?: string;
  // Model-written page meta (D1) — persisted with the page content (draft →
  // published), consumed by generateMetadata/OG/JSON-LD on the public render.
  seo?: { title?: string; description?: string };
}

/**
 * Block types the composition pipeline CANNOT ship, and therefore must not
 * advertise (plan §4, wave D — «спалені слоти»):
 *
 *  - `switchback` needs a trusted image per row, and the model casts photos by
 *    id only for hero and gallery — a free-form `imageUrl` would be invented, so
 *    assemble() has always dropped the whole block. Wiring it properly means a
 *    photoId-cast arm plus a photo budget shared with the gallery; until then,
 *    advertising it burns a slot the model spends on a section that never
 *    renders. The `story` section stays REGISTERED so already-stored content
 *    keeps rendering through WireSwitchback — it is only hidden from the model.
 *  - `richText` has no section in the wireframe at all, so resolvedSection()
 *    drops it. The schema stays for storage compatibility.
 *
 * One list, read by both prompt docs and the drop filter — so re-enabling
 * either block is deleting one entry, not hunting three call sites.
 */
const UNREACHABLE_TYPES = new Set<BlockType>(["switchback", "richText"]);

function buildLibraryDoc(): string {
  return (Object.keys(blockLibrary) as BlockType[])
    // autoInjected blocks (lead_form) are added by code, never offered to the model.
    .filter((t) => !blockLibrary[t].autoInjected)
    .filter((t) => !UNREACHABLE_TYPES.has(t))
    .map((t) => {
      const e = blockLibrary[t];
      return `- ${t} (${e.label}; роль: ${e.role}; макс ${e.maxPerPage}× на сторінку): ${e.description}`;
    })
    .join("\n");
}

/**
 * Template menu for the model: every offered template with its section list
 * (id — label — description — «контент за схемою блоку X»). Lives in the USER
 * message's static prefix, before the volatile dossier tail (04 §2).
 *

 * There is exactly ONE wireframe, so this prefix is byte-stable per vertical —
 * the best case for prompt caching.
 */
function buildSectionDoc(template: SiteTemplate): string {
  const ids = [
    ...template.order,
    ...Object.keys(template.sections).filter((id) => !template.order.includes(id)),
  ];
  return ids
    .map((id) => {
      const def = template.sections[id];
      if (!def) return null;
      // A section fed by an unreachable block type is a slot the model would
      // spend on nothing (see UNREACHABLE_TYPES).
      if (UNREACHABLE_TYPES.has(def.block)) return null;
      const vs = def.variants
        ? ` [layout: default | ${Object.keys(def.variants).join(" | ")}]`
        : "";
      return `· ${id} — ${def.label}: ${def.description} (блок ${def.block})${vs}`;
    })
    .filter(Boolean)
    .join("\n");
}

function buildSystem(vertical: VerticalConfig): string {
  // The page is composed against a single structural wireframe; its surface is
  // written by a second call (lib/design/wire-style.ts). Nothing about the LOOK
  // is decided here, so the rules below are purely about composition and copy.
  const templateRule = `СЕКЦІЇ: компонуй сторінку ЛИШЕ із секцій, перелічених у повідомленні нижче. Правила:`;
  return `Ти — досвідчений веб-дизайнер і копірайтер, що збирає односторінковий сайт українському бізнесу: ${vertical.label} (${vertical.personaHint}).
Тон і акценти: ${vertical.genHint}.
Ти НЕ пишеш HTML. Ти КОМПОНУЄШ сторінку з фіксованої бібліотеки блоків: обираєш, які блоки і в якому порядку, і заповнюєш їхній вміст. Виклич інструмент build_site.

ПРАВИЛА КОМПОЗИЦІЇ (обов'язкові):
- Перший блок — завжди hero. Останній — завжди contacts.
- Між ними — від ${COMPOSITION_RULES.minMiddle} до ${COMPOSITION_RULES.maxMiddle} блоків із бібліотеки; набір і порядок обираєш під конкретний бізнес.
- Не використовуй жоден тип блоку частіше за його ліміт "макс ×". (На сайті-ШАБЛОНІ цей ліміт діє на СЕКЦІЮ, а не на тип блоку — РІЗНІ секції можуть мати однаковий тип; див. правила шаблону нижче.)
- Якщо тип дозволено двічі (напр. services) і контенту справді багато — два блоки МУСЯТЬ мати різні заголовки й різний зміст (основні / додаткові), ніколи не дублюй той самий список.
- Різні бізнеси мають отримувати РІЗНІ набори й порядок блоків — не роби однаковий шаблон.

GROUNDING (критично для довіри):
- Факти — назва, телефон, адреса, години, ціни й назви послуг, відгуки — копіюй ТОЧНО з блоку «ПІДТВЕРДЖЕНІ ВЛАСНИКОМ ФАКТИ». НЕ вигадуй і не змінюй їх.
- Усе в <scraped_data> (біо, підписи, OCR, контакти-кандидати) — СИРОВИНА для тону, підписів і фото-кастингу, а НЕ факти: НІКОЛИ не переноси звідти телефони/адреси/email/години у реквізити сайту. Реквізити — лише з підтверджених фактів.
- ЖОДНИХ вигаданих конкретик: тривалостей, кількостей, гарантій, років досвіду, цифр — лише те, що прямо є в наданих даних. НІКОЛИ не вигадуй числа у stats.
- Маркетинговий текст (заголовки, слогани, описи, заклики) — пиши сам, тепло, живою українською, доречно для ніші.
- Не вигадуй посилань на зображення.
- ЦІНИ: якщо у послуг НЕМАЄ цін у фактах — не залишай порожніх прайс-колонок і не пиши плейсхолдери («грн», «від …», «—»): подай послуги описово, без цінової сітки. Ціни, які Є у фактах, копіюй 1:1.

БРЕНД-ГОЛОС (пиши як ЦЕЙ бізнес, не «як усі»):
- Виведи тон із блоку БРЕНД-ГОЛОС, реальних підписів постів і дослівних слів власника: переймай їхню лексику, улюблені слова, міру теплоти чи стриманості.
- Якщо дано стем нікнейму — можеш ОБЕРЕЖНО утворити з нього теплу форму звертання чи внутрішнє слівце бренду (напр. lapusi → «лапусики»), якщо це пасує тону.
- Якщо дано орієнтир (вулиця/метро) — згадай його природно один раз (напр. у контактному чи hero-тексті).

ФОТО-КАСТИНГ (за id — URL ти не бачиш, їх підставляє код):
- У <scraped_data> є медіа-інвентар: id, тип, опис, підпис, OCR. Кастуй ЛИШЕ фото з позначкою наСайт:так.
- hero.photoId — ОДНЕ найатмосферніше / найзагальніше фото як фон першого екрана.
- У gallery обери решту придатних фото (images[].photoId) і дай кожному короткий title на основі РЕАЛЬНОГО підпису/опису (category — коли доречно). НЕ вигадуй id і не описуй того, чого не видно.
- Фото для послуг/команди підставляє код — не вигадуй їх.

${templateRule}
- Для КОЖНОГО блоку вкажи section = id секції шаблону; тип блоку має відповідати вказаному («блок X»).
- Якщо секція має layout-варіанти [layout: default | …] — обери variant, що найкраще пасує цьому бізнесу; якщо не впевнений, не вказуй (буде default).
- HERO має РІВНО три макети, обирай свідомо під бізнес і під ФОТО:
  · split — текст ліворуч, фото праворуч. Універсальний; бери, коли фото важливе, але не самодостатнє (прайс-орієнтований бізнес, багато тексту).
  · mirror — те саме дзеркально, фото ліворуч. Коли фото має вести око першим (візуальні ніші: квіти, кондитерська, б'юті).
  · banner — фото на весь екран тлом, світлий текст по центру. Найсильніший, але ЛИШЕ якщо в медіа-інвентарі є фото з високою «якість:N/10» і БЕЗ позначки «текст поверх фото» (ідеально — з «годиться на банер»). Слабке, темне чи «текстове» фото на весь екран виглядає гірше за будь-який інший макет — тоді бери split або mirror.
- hero-секція — перша, contacts-секція — остання; порядок — орієнтир, не догма.
- Кожну секцію зазвичай один раз. Якщо контенту СПРАВДІ багато — секцію можна використати ДВІЧІ (напр. послуги: основні + додаткові), але лише секцію з layout-варіантами, і повтори МУСЯТЬ мати РІЗНІ variant і РІЗНІ заголовки — сусідні однакові макети виглядають як помилка верстки. РІЗНІ секції можуть живитись ОДНИМ типом блоку (ліміт «макс ×» діє на секцію, не на тип).

SEO-МЕТА (обов'язково заповни seo):
- seo.title — за формулою «{головна послуга} у {місто} — {назва}», до 60 символів. Головну послугу бери з фактів, місто — з фактів.
- seo.description — 1–2 продаючі речення до 150 символів: що робить бізнес, для кого, у якому місті. Природною мовою, без лапок і переліку через кому всіх послуг.

SEO В ТЕКСТАХ СТОРІНКИ:
- Частину заголовків секцій пиши з ключовими словами ніші, за якими шукають у Google («Весільні букети», «Ремонт ходової»), а НЕ лише образними («Наша магія»). Образність — у підзаголовки й описи.
- Місто згадай природно у 1–2 місцях сторінки (напр. hero-підзаголовок або «про нас») — НЕ в кожному заголовку і НЕ списком міст. Переспам ключовими словами читається як спам і шкодить довірі.

HERO-ЗОБРАЖЕННЯ: заповни imageSubject — короткий опис АНГЛІЙСЬКОЮ (до 15 слів) атмосферного ФОНОВОГО зображення, що асоціюється саме з цим бізнесом: текстури, матеріали, гра світла, природа. ЗАБОРОНЕНО: приміщення/фасади/вітрини, впізнавані товари як «наші», люди, будь-який текст. Приклад для хімчистки: "soft folded fresh linen textures in airy light".`;
}

// Strict mode (`strict: true`) is deliberately NOT enabled on this tool: strict
// tool use demands additionalProperties:false with every property required, and
// this optional-heavy 17-variant discriminated union was already rejected by
// structured outputs as "grammar too large" (original note above). Instead the
// call is ONE attempt + one deterministic repair pass (drop invalid blocks,
// re-parse) — replacing the old 2-attempt retry, whose second full generation
// never fixed schema drift more reliably than the repair does.
const buildSiteTool = {
  name: "build_site",
  description: "Зібрати односторінковий сайт: скомпонувати масив blocks — які секції, у якому порядку, з яким вмістом.",
  input_schema: z.toJSONSchema(generationSchema),
} as unknown as Anthropic.Tool;

export async function generateSite(
  // The Business Dossier (03 §1.5) — the single rich context for generation:
  // owner-confirmed facts, brand-voice cues, IG bio/captions, the per-photo
  // text inventory the model casts from, and the owner's own words.
  dossier: Dossier,
  verticalId?: string,
  // Owner media (§4.8 amended, 03 §2.1): the model sees per-photo TEXT metadata
  // + ids (inside the dossier), never URLs — this object only drives the
  // deterministic id→URL mapping in assemble(). Optional so callers that don't
  // thread media keep working (no photos → no hero/gallery imagery).
  media?: SiteMedia,
  // Caller's overall deadline (generateDraft threads one across its whole
  // model chain so the serverless budget can't be outlived).
  signal?: AbortSignal,
  // Uniform roll in [0, 1) — the seeded FALLBACK hero layout, used only when the
  // model named none or named an unknown one (see heroVariantForSeed). Same
  // convention as the hue roll (lib/design/hue.ts). Default 0 → "split", i.e.
  // exactly today's behaviour for a caller that doesn't thread a seed yet.
  variantSeed = 0,
): Promise<GeneratedSite> {
  const client = getAnthropic();
  const vertical = getVertical(verticalId);
  // One structural wireframe, always (cleanup 2026-07-27). Template choice,
  // the seeded shortlist and the design-DNA axes are gone: the model composes
  // from the whole block library and a second call writes the stylesheet.
  const template = getTemplate(WIRE_TEMPLATE_ID);
  if (!template) throw new Error(`wireframe template "${WIRE_TEMPLATE_ID}" not registered`);

  // Boundary cast (03 §2.2): the dossier's untyped facts blob must be complete
  // BusinessFacts here — generation cannot run on partial facts.
  const factsParsed = businessFactsSchema.safeParse(dossier.facts ?? {});
  if (!factsParsed.success) {
    const issues = factsParsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`generateSite: dossier.facts is not valid BusinessFacts (${issues})`);
  }
  const facts = factsParsed.data;

  // Prompt order is cache-friendly (04 §2): the static docs come FIRST and are
  // byte-stable per vertical, the volatile per-business dossier LAST.
  const userPrompt = `Бібліотека блоків:
${buildLibraryDoc()}

Секції, з яких компонується сторінка:
${buildSectionDoc(template)}

${formatDossierForPrompt(dossier)}

Збери сайт за правилами вище і виклич build_site.`;

  const res = await client.messages.create({
    model: GEN_MODEL,
    // Sonnet 5 tokenizer runs ~30% heavier for the same text (03 §0.1) — the
    // old 16000 cap starved big compositions.
    max_tokens: 20000,
    // Sonnet 5: `budget_tokens` returns 400 — adaptive thinking + nested
    // output_config.effort is the supported surface (03 §0.1). Thinking stays
    // incompatible with a forced tool_choice → "auto"; a missing tool call is
    // a hard failure below (no retry).
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    // Belt at the API boundary: the dossier carries emoji-heavy scraped text —
    // a lone surrogate anywhere in the body is a hard 400 (§lib/ai/sanitize).
    system: stripLoneSurrogates(buildSystem(vertical)),
    tools: [buildSiteTool],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: stripLoneSurrogates(userPrompt) }],
  }, { signal });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Generation returned no build_site call (stop_reason=${res.stop_reason})`);
  }

  let parsed = generationSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    // Deterministic repair pass: schema failures are per-block in practice —
    // drop the invalid blocks and re-parse. assemble() then backfills anything
    // load-bearing (funnel, contacts), so a partial composition still ships.
    const input = toolUse.input as { blocks?: unknown[] } | null;
    if (input && Array.isArray(input.blocks)) {
      parsed = generationSchema.safeParse({
        ...input,
        blocks: input.blocks.filter((b) => genBlockSchema.safeParse(b).success),
      });
    }
  }
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Generation failed schema validation: ${issues}`);
  }

  return {
    templateId: template.id,
    blocks: assemble(parsed.data.blocks, facts, media, template, dossier, variantSeed),
    imageSubject: parsed.data.imageSubject,
    seo: clampSeo(parsed.data.seo),
  };
}

// ---------------------------------------------------------------------------
// Hero layout (plan §2, wave B). The wireframe ships three structural heroes;
// the model picks one from the content. When it doesn't — or names one the
// section doesn't define — the choice is SEEDED rather than always landing on
// `split`. That silent always-split default is why two test bakeries got the
// same first screen: the model had an empty variant set to choose from, so
// every site opened identically.
// ---------------------------------------------------------------------------
const HERO_VARIANTS = ["split", "mirror", "banner"] as const;

/**
 * Uniform roll in [0, 1) → a hero layout id.
 *
 * `allowBanner` is the photo veto, not a preference: a full-bleed hero is only
 * as good as the picture behind it, and blowing up a blurry shot or one with a
 * price list burned into it is worse than any other layout. A site with NO hero
 * photo may still roll banner — with no backdrop it renders as a centred
 * text-only opener, which is a genuinely different composition, not a broken one.
 */
export function heroVariantForSeed(roll: number, allowBanner: boolean): string {
  const pool = allowBanner ? HERO_VARIANTS : HERO_VARIANTS.filter((v) => v !== "banner");
  const t = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 1 - 1e-9) : 0;
  return pool[Math.floor(t * pool.length)];
}

/** Is this hero photo strong enough to carry a full-bleed banner? */
function bannerWorthy(meta: PhotoMeta | undefined): boolean {
  if (meta?.burnedText === true) return false;
  return photoScore(meta) >= USABLE_SITE_QUALITY;
}

// ---------------------------------------------------------------------------
// Template section resolution. A block "fills" a template section whose `.block`
// equals the block's type. `sectionForType` finds that section id (preferring a
// section whose id IS the type — e.g. hero/contacts/stats/faq/cta/lead_form —
// else the first match, e.g. richText→about, services→pricing). Returns
// undefined when the template has NO home for this type.
// ---------------------------------------------------------------------------
function sectionForType(template: SiteTemplate, type: string): string | undefined {
  const direct = template.sections[type];
  if (direct && direct.block === type) return type;
  return Object.entries(template.sections).find(([, def]) => def.block === type)?.[0];
}

/**
 * Resolve the section id a block should carry under `template`:
 *  - keep the model's `section` when it's valid (exists AND matches the type);
 *  - else fall back to `sectionForType` (reassign to the template's home for it);
 *  - undefined when the type has no home at all → the caller drops the block.
 *
 * Typed on the two fields it reads, so it works on a GENERATION block too (the
 * hero's layout has to resolve before its props are converted).
 */
function resolvedSection(
  template: SiteTemplate | undefined,
  b: { type: BlockType; section?: string },
): string | undefined {
  if (!template) return undefined;
  const s = b.section;
  if (s && template.sections[s]?.block === b.type) return s;
  return sectionForType(template, b.type);
}

// The section's layout variant is the MODEL's choice (b.variant). Validate it
// against the section — keep it only if that section actually defines it;
// otherwise fall back to the default layout. No lottery: the model decides.
function resolvedVariant(
  template: SiteTemplate | undefined,
  section: string | undefined,
  requested: string | undefined,
): string | undefined {
  if (!template || !section || !requested) return undefined;
  return template.sections[section]?.variants?.[requested] ? requested : undefined;
}

// ---------------------------------------------------------------------------
// Post-generation: cast photos id→URL, enforce composition, ground facts,
// project nav placement.
// ---------------------------------------------------------------------------
function assemble(
  raw: GenBlockInstance[],
  facts: BusinessFacts,
  media: SiteMedia | undefined,
  template: SiteTemplate | undefined,
  dossier: Dossier,
  variantSeed: number,
): StoredBlock[] {
  const photos = media?.photos ?? [];
  const generatedHero = media?.generatedHero;
  const metaByUrl = new Map((media?.photoMeta ?? []).map((m) => [m.url, m]));

  // Casting eligibility (§4.8 amended, 03 §2.1): a photo the agent marked as an
  // info source (text_source), hidden, or vision-rejected (useOnSite === false)
  // never renders on the site — it feeds the dossier only. Photos without meta
  // are eligible (pre-refactor uploads).
  const eligible = photos.filter((url) => isEligiblePhoto(metaByUrl.get(url)));
  // id → URL, derived in code (photoIdFor fallback for legacy meta rows) — the
  // model casts by these ids and NEVER supplies a URL; an unknown id maps to
  // nothing and the deterministic fallbacks below take over.
  const urlById = new Map(eligible.map((url) => [metaByUrl.get(url)?.id ?? photoIdFor(url), url]));

  const businessName = facts.businessName;
  // D3: deterministic alt base for owner photos — name + city (local-SEO
  // keywords that are always TRUE). Descriptive alts are never model-written;
  // the vision layer's per-photo description (photoMeta.alt) wins when present.
  const altBase = facts.city ? `${businessName}, ${facts.city}` : businessName;
  const photoAlt = (url: string, fallback: string) =>
    metaByUrl.get(url)?.alt?.trim() || fallback;
  // Gallery-title fallback (03 §2.4 gallery captions): the photo's real IG
  // caption, excerpted — never an invented description.
  const captionFor = (url: string): string | undefined => {
    const c = metaByUrl.get(url)?.sourceCaption;
    if (!c) return undefined;
    const flat = c.replace(/\s+/g, " ").trim();
    if (!flat) return undefined;
    return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat;
  };

  // Hero photo := the model's cast id when it maps to an eligible photo → the
  // best-vetted eligible photo → the generated atmospheric hero (assigned at
  // conversion below). The fallback used to be `eligible[0]`, i.e. whatever the
  // owner posted most recently — a banner-sized bet on feed order (plan §1).
  // The gallery pool is everything eligible minus the hero's photo, so the hero
  // background never repeats inside the gallery.
  const genHero = raw.find((b) => b.type === "hero");
  const castHeroId = genHero?.type === "hero" ? genHero.props.photoId : undefined;
  const heroPhoto =
    (castHeroId ? urlById.get(castHeroId) : undefined) ?? pickHeroUrl(eligible, metaByUrl);
  const galleryPool = eligible.filter((u) => u !== heroPhoto);

  type StoredGalleryImage = { url: string; alt?: string; title?: string; category?: string };
  const galleryFromPool = (): StoredGalleryImage[] =>
    galleryPool.map((url, i) => ({
      url,
      alt: photoAlt(url, `${altBase} — фото ${i + 1}`),
      ...(captionFor(url) && { title: captionFor(url) }),
    }));
  // The model's cast list (валідні id, no hero repeat, deduped) wins — its
  // titles/categories are the whole point of casting. A cast that maps to <2
  // real photos is unusable → all remaining eligible photos, captions as titles.
  const galleryFromCast = (
    cast: { photoId: string; title?: string; category?: string }[],
  ): StoredGalleryImage[] => {
    const out: StoredGalleryImage[] = [];
    const seen = new Set<string>();
    for (const item of cast) {
      const url = urlById.get(item.photoId);
      if (!url || url === heroPhoto || seen.has(url)) continue;
      seen.add(url);
      out.push({
        url,
        alt: photoAlt(url, `${altBase} — фото ${out.length + 1}`),
        ...((item.title ?? captionFor(url)) && { title: item.title ?? captionFor(url) }),
        ...(item.category && { category: item.category }),
      });
    }
    return out.length >= 2 ? out : galleryFromPool();
  };

  // GENERATION → STORED conversion (03 §2.1): the id-cast arms become concrete
  // storage URLs here — deterministically, so nothing model-invented can ever
  // reach an image field. All other arms are structurally identical.
  const converted: BlockInstance[] = raw.map((b): BlockInstance => {
    if (b.type === "hero") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { photoId: _photoId, ...props } = b.props;
      const imageUrl = heroPhoto ?? generatedHero;
      const imageAlt = heroPhoto
        ? photoAlt(heroPhoto, altBase)
        : imageUrl
          ? `Атмосферне зображення — ${altBase}`
          : undefined;
      // Layout: the model's choice when the section actually defines it, else
      // the seeded roll — vetoing `banner` when the photo that would fill the
      // screen isn't good enough for it. groundAndPlace re-validates either way.
      const variant =
        resolvedVariant(template, resolvedSection(template, b), b.variant) ??
        heroVariantForSeed(
          variantSeed,
          bannerWorthy(heroPhoto ? metaByUrl.get(heroPhoto) : undefined),
        );
      return { type: "hero", props: { ...props, imageUrl, imageAlt }, section: b.section, variant };
    }
    if (b.type === "gallery") {
      // Background image generation (owner decision): a gallery too thin to
      // render ships with `pendingImages` shimmer placeholders and the after()
      // job patches real URLs in later.
      //
      // The placeholders TOP UP the owner's photos — they never replace them
      // (§4.8). Since the trigger moved from «zero photos» to «fewer than three
      // USABLE photos», this branch now also runs for sites that DO have one or
      // two real photos, and emptying the array here would have deleted them.
      const images = galleryFromCast(b.props.images);
      const pending = media?.generatedPending ?? 0;
      const topUp = images.length < 2 ? pending : 0;
      return {
        type: "gallery",
        props:
          topUp > 0
            ? { title: b.props.title, images, pendingImages: topUp }
            : { title: b.props.title, images },
        section: b.section,
        variant: b.variant,
      };
    }
    return b;
  });

  const hero = converted.find((b) => b.type === "hero");
  const contacts = converted.find((b) => b.type === "contacts");

  // Deterministic drop rules for the fact-anchored blocks (03 §2.4): no
  // confirmed address → no map; no confirmed handle → no instagram_cta. The
  // grounding pass then overwrites the fields 1:1 for the survivors.
  const hasAddress = Boolean(facts.address?.trim());
  const hasIgHandle = Boolean(normalizeIgHandle(facts.instagram));

  const perSection: Record<string, number> = {};
  const middle = converted
    .filter((b) => b.type !== "hero" && b.type !== "contacts" && b.type !== "lead_form")
    // Belt for the types the prompt no longer offers (UNREACHABLE_TYPES): a
    // switchback would carry model-invented per-row images (§4.8).
    .filter((b) => !UNREACHABLE_TYPES.has(b.type))
    // gallery is kept when ≥2 real photos fill it — or when background
    // generation will (pendingImages shimmer placeholders). A fabricated or
    // single-photo gallery still reads as a bug on the live site (§4.8).
    .filter(
      (b) =>
        b.type !== "gallery" ||
        b.props.images.length >= 2 ||
        (b.props.pendingImages ?? 0) > 0,
    )
    .filter((b) => b.type !== "map" || hasAddress)
    .filter((b) => b.type !== "instagram_cta" || hasIgHandle)
    // On a template site, drop middle blocks whose type maps to no section — they
    // would otherwise render via the default registry and break the template look.
    .filter((b) => !template || resolvedSection(template, b) !== undefined)
    .filter((b) => {
      // Template sites cap per SECTION, not per block type: studio feeds
      // features/howitworks/pricing from the SAME `services` schema, and a
      // per-type cap of 1 would silently drop two of them.
      if (template) {
        const section = resolvedSection(template, b)!;
        const used = (perSection[section] ?? 0) + 1;
        perSection[section] = used;
        // C1: a section may repeat ONCE (rich content, e.g. services: main +
        // additional) — but only when it ships alternate layouts, so the two
        // instances can look different. A single-layout section repeated reads
        // as a rendering bug, never as design (plan risk #1).
        const hasAltLayouts =
          Object.keys(template.sections[section]?.variants ?? {}).length > 0;
        return used <= (hasAltLayouts ? 2 : 1);
      }
      const seenCount = (perSection[b.type] ?? 0) + 1;
      perSection[b.type] = seenCount;
      return seenCount <= blockLibrary[b.type].maxPerPage;
    })
    .slice(0, COMPOSITION_RULES.maxMiddle);

  const modelChoseGallery = middle.some((b) => b.type === "gallery");

  // The lead funnel is the product's value core (§5.6): force-inject the
  // lead_form on EVERY site, right before the contacts closer. Presence is an
  // invariant enforced by code, never a model choice.
  const leadForm: BlockInstance = {
    type: "lead_form",
    props: {
      title: "Залишити заявку",
      subtitle: "Заповніть форму — і ми звʼяжемось з вами найближчим часом.",
      buttonLabel: "Надіслати заявку",
    },
  };

  // With ≥2 eligible photos and no model gallery, inject one from the uploads
  // right before the lead funnel — routed through the same placement path as
  // any block. Skip on a template with no gallery section: it would render via
  // the default (light) registry component inside the template's shell.
  const canHostGallery = !template || sectionForType(template, "gallery") !== undefined;
  const pendingGenerated = media?.generatedPending ?? 0;
  const injectedGallery: BlockInstance[] =
    galleryPool.length >= 2 && !modelChoseGallery && canHostGallery
      ? [{ type: "gallery", props: { title: "Наші фото", images: galleryFromPool() } }]
      : pendingGenerated > 0 && !modelChoseGallery && canHostGallery
        ? [{ type: "gallery", props: { title: "Наша атмосфера", images: [], pendingImages: pendingGenerated } }]
        : [];

  // The contacts closer is part of the funnel invariant (§5.6): if the model
  // omitted it, synthesize one — groundAndPlace then fills it with the real
  // contact facts, so every generated site ends with lead_form + contacts.
  const contactsBlock: BlockInstance =
    contacts ?? { type: "contacts", props: { title: "Контакти" } };

  const ordered: BlockInstance[] = [
    ...(hero ? [hero] : []),
    ...middle,
    ...injectedGallery,
    leadForm,
    contactsBlock,
  ];

  // The generated hero (§4.8) is a trusted, bucket-hosted URL like a real photo.
  const allowed = new Set(photos);
  if (generatedHero) allowed.add(generatedHero);

  const seen: Partial<Record<BlockType, number>> = {};
  const factHrefs = allowedFactHrefs(facts);
  const igFollowers = dossier.ig.followers;
  const placed = ordered.map((b) =>
    groundAndPlace(
      groundHrefs(groundImages(b, allowed), facts, factHrefs),
      facts,
      seen,
      template,
      igFollowers,
    ),
  );

  // C1/C4 safety net: a repeated section must never repeat the SAME layout —
  // the prompt asks for different variants, but a model slip would render two
  // identical-looking sections (reads as a bug). Deterministic reassignment:
  // the later instance gets the first layout the section hasn't used yet
  // (guaranteed to exist — repeats are only allowed on sections WITH variants).
  if (template) {
    const usedLayouts = new Map<string, Set<string>>();
    for (let i = 0; i < placed.length; i++) {
      const sb = placed[i];
      // Hidden blocks don't render/number — skip them so the pass keeps
      // matching PageRenderer semantics if it's ever reused on stored content
      // (generation itself always emits hidden:false).
      if (!sb.section || sb.hidden) continue;
      const used = usedLayouts.get(sb.section) ?? new Set<string>();
      usedLayouts.set(sb.section, used);
      if (used.has(sb.variant ?? "")) {
        const options: (string | undefined)[] = [
          undefined,
          ...Object.keys(template.sections[sb.section]?.variants ?? {}),
        ];
        placed[i] = { ...sb, variant: options.find((v) => !used.has(v ?? "")) };
      }
      used.add(placed[i].variant ?? "");
    }
  }

  // Second href pass, AFTER placement: only now are the real in-page targets
  // known. Template sites use section ids as DOM ids, classic sites use the
  // block anchors — and the lead form's id differs between them ("lead_form"
  // vs "lead"). Any #anchor that resolves to nothing (model-invented #booking,
  // bare "#", or the groundHrefs placeholder on a classic site) is rewritten
  // to the lead anchor that actually exists on THIS page.
  // Template ids must be counted the way PageRenderer RENDERS them (visible
  // blocks, per-section numbering, "-N" suffix from the second instance) —
  // otherwise a link to the second instance (#services-2) would be a "missing"
  // anchor and get rewritten to the funnel (codex review, wave C).
  const validAnchors = new Set<string>();
  const sectionSeen: Record<string, number> = {};
  for (const sb of placed) {
    if (template) {
      if (sb.section && !sb.hidden) {
        const n = (sectionSeen[sb.section] = (sectionSeen[sb.section] ?? 0) + 1);
        validAnchors.add(n === 1 ? `#${sb.section}` : `#${sb.section}-${n}`);
      }
    } else if (sb.anchor) {
      validAnchors.add(sb.anchor);
    }
  }
  const leadAnchor = template ? "#lead_form" : "#lead";
  return placed.map((sb) =>
    mapHrefFields(sb, (href) =>
      href?.startsWith("#") && !validAnchors.has(href) ? leadAnchor : href,
    ),
  );
}

/**
 * Deterministic image grounding (§4.8): hero/gallery imagery is already cast
 * id→URL at conversion time, so this pass only strips the per-item image slots
 * the model can still write free-form — anything not in the uploaded set dies.
 */
function groundImages(b: BlockInstance, allowed: Set<string>): BlockInstance {
  switch (b.type) {
    case "services":
      // Per-service images are model-invented → strip any not in the uploaded set.
      return {
        ...b,
        props: {
          ...b.props,
          items: b.props.items.map((it) =>
            it.imageUrl && !allowed.has(it.imageUrl) ? { ...it, imageUrl: undefined } : it,
          ),
        },
      };
    case "team":
      // Per-person photos are model-invented → strip any not in the uploaded set
      // (like services), so team cards fall back to initials rather than showing a
      // fabricated/hotlinked portrait. Honours the schema's grounding promise.
      return {
        ...b,
        props: {
          ...b.props,
          items: b.props.items.map((it) =>
            it.photo && !allowed.has(it.photo) ? { ...it, photo: undefined } : it,
          ),
        },
      };
    default:
      return b;
  }
}

/**
 * Deterministic link grounding (§4.4/§4.8, mirror of groundImages): the model
 * writes marketing labels, but every href must point somewhere REAL — an
 * in-page anchor, the owner's confirmed phone, our own Storage, or a social
 * link present in the facts. Anything invented (bare instagram.com, /booking…)
 * is rewritten to "#lead_form": the funnel is always a truthful destination.
 */
function allowedFactHrefs(facts: BusinessFacts): Set<string> {
  const set = new Set<string>();
  for (const s of facts.socials ?? []) {
    const href = s.href.trim();
    if (href) set.add(href);
  }
  const tg = telegramHref(facts.telegram);
  if (tg) set.add(tg);
  const vb = viberHref(facts.viber);
  if (vb) set.add(vb);
  // E9/H3: with a confirmed handle in the facts, a CTA to the owner's real
  // Instagram profile is a truthful destination (bare instagram.com is not).
  const ig = instagramHref(facts.instagram);
  if (ig) set.add(ig);
  return set;
}

/** The one place that knows which block fields carry links (§4.1 registry
 *  spirit): both grounding passes walk hrefs through this. */
function mapHrefFields<T extends BlockInstance>(
  b: T,
  fn: (href: string | undefined, label: string | undefined) => string | undefined,
): T {
  switch (b.type) {
    case "hero":
      return {
        ...b,
        props: {
          ...b.props,
          ctaHref: fn(b.props.ctaHref, b.props.ctaLabel),
          secondaryCtaHref: fn(b.props.secondaryCtaHref, b.props.secondaryCtaLabel),
        },
      };
    case "cta":
      return {
        ...b,
        props: { ...b.props, buttonHref: fn(b.props.buttonHref, b.props.buttonLabel) },
      };
    case "switchback":
      return {
        ...b,
        props: {
          ...b.props,
          items: b.props.items.map((it) => ({
            ...it,
            buttonHref: fn(it.buttonHref, it.buttonLabel),
          })),
        },
      };
    default:
      return b;
  }
}

function groundHrefs(
  b: BlockInstance,
  facts: BusinessFacts,
  factHrefs: Set<string>,
): BlockInstance {
  // A label without a target would render as a dead "#" link → send it to the
  // funnel; an empty pair stays empty (no button rendered at all). "#lead_form"
  // here is a placeholder — the post-placement pass in assemble() rewrites any
  // anchor to one that actually exists on the page.
  const ground = (href: string | undefined, label: string | undefined): string | undefined => {
    if (!href?.trim()) return label?.trim() ? "#lead_form" : href;
    const value = href.trim();
    if (value.startsWith("#")) return value;
    if (/^tel:/i.test(value)) {
      // Requisites are copied 1:1 from facts (§4.4): a model-typed number is
      // never trusted — a tel: link always dials the owner's confirmed phone.
      const digits = normalizeUaPhoneDigits(facts.phone);
      return digits ? `tel:+${digits}` : "#lead_form";
    }
    if (isStorageUrl(value) || factHrefs.has(value)) return value;
    return "#lead_form";
  };

  return mapHrefFields(b, ground);
}

function computePlacement(
  type: BlockType,
  seen: Partial<Record<BlockType, number>>,
  template: SiteTemplate | undefined,
  section: string | undefined,
): BlockPlacement {
  const lib = blockLibrary[type];
  // Every block carries the wireframe `section` it fills; the look is the
  // generated stylesheet's job, never a per-block choice.
  if (type === "contacts") {
    return { anchor: "#contacts", navLabel: lib.navLabel, showInNav: true, hidden: false, section };
  }
  if (type === "lead_form") {
    return { anchor: "#lead", navLabel: lib.navLabel, showInNav: true, hidden: false, section };
  }
  if (lib.role === "middle" && lib.inNav) {
    const n = (seen[type] = (seen[type] ?? 0) + 1);
    return {
      anchor: n === 1 ? `#${type}` : `#${type}-${n}`,
      navLabel: lib.navLabel,
      showInNav: true,
      hidden: false,
      section,
    };
  }
  return { showInNav: false, hidden: false, section };
}

function groundAndPlace(
  b: BlockInstance,
  facts: BusinessFacts,
  seen: Partial<Record<BlockType, number>>,
  template: SiteTemplate | undefined,
  igFollowers: number | undefined,
): StoredBlock {
  const section = resolvedSection(template, b);
  const variant = resolvedVariant(template, section, b.variant);
  const placement = computePlacement(b.type, seen, template, section);

  // Grounding (§4.4): contact facts are known — force them verbatim.
  if (b.type === "contacts") {
    return {
      ...b,
      props: {
        ...b.props,
        phone: facts.phone ?? b.props.phone,
        address: facts.address ?? b.props.address,
        hours: facts.hours ?? b.props.hours,
        viber: facts.viber ?? b.props.viber,
        telegram: facts.telegram ?? b.props.telegram,
        // Strict (unlike the ?? fields above): a handle is only ever a FACT —
        // a model-invented one must not survive when the owner gave none.
        instagram: facts.instagram,
      },
      ...placement,
      variant,
    };
  }

  // map: the SHOWN address is the confirmed fact, 1:1 (assemble() already
  // dropped the block when the fact is absent — ?? only keeps the type happy).
  // The embed's search string is built here and never taken from the model:
  // «вул. Січових Стрільців, 12» alone lands in whichever town Google likes,
  // so the confirmed city is appended for the QUERY only (plan §4.4). The
  // requisite check still compares `address` — this field is not a requisite.
  if (b.type === "map") {
    const address = facts.address ?? b.props.address;
    const mapQuery = facts.city?.trim() ? `${address}, ${facts.city.trim()}` : undefined;
    return {
      ...b,
      props: { ...b.props, address, mapQuery },
      ...placement,
      variant,
    };
  }

  // instagram_cta: handle is the CONFIRMED fact; the follower count comes from
  // the IG snapshot only — a model-invented number must never render (§4.4).
  if (b.type === "instagram_cta") {
    return {
      ...b,
      props: {
        ...b.props,
        handle: facts.instagram ?? b.props.handle,
        followersCount: igFollowers,
      },
      ...placement,
      variant,
    };
  }

  return { ...b, ...placement, variant };
}
