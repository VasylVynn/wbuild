import "server-only";
import { safeSlice, stripLoneSurrogates } from "@/lib/ai/sanitize";
import {
  buildFactsCorpus,
  type DesignSpec,
  type FactsCorpus,
  type SectionPlanEntry,
} from "@/lib/site/design-spec";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { llmCreate, GEN_MODEL, type LlmTool } from "./llm";
import {
  heroSchema,
  switchbackItemSchema,
  serviceItemSchema,
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
import {
  cleanBenefitStrip,
  BENEFITS_TITLE,
  itemCountOf,
  meetsItemFloor,
  scrubVisibleUrls,
} from "@/lib/blocks/hygiene";
import {
  getTemplate,
  type SiteTemplate,
  type TemplateSectionDef,
} from "@/lib/templates/registry";
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
  normalizeTelegramUsername,
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
// STORED blockInstanceSchema in exactly four arms: hero gains `photoId` and
// loses the url fields; gallery items are `{photoId, title?, category?}`
// instead of `{url, alt, …}`; services items and switchback (story) rows swap
// their free-form `imageUrl` for an optional/required `photoId` (V3 §5 —
// every image slot the model can address is an id-cast, never a URL). One arm
// is MISSING on purpose: richText has no generation surface at all (see
// UNREACHABLE_TYPES). Everything else reuses the registry prop schemas
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

// Services photo casting (V3 §5, the cards-with-photo variant): same id-cast
// door as the gallery. Optional — a services block without photos is the norm;
// the prompt tells the model when a cast is appropriate.
const genServiceItemSchema = serviceItemSchema.omit({ imageUrl: true }).extend({
  photoId: z
    .string()
    .optional()
    .describe(
      "id фото з медіа-інвентаря (наСайт:так), що СПРАВДІ показує цю послугу — лише для фото-макета послуг; інакше пропусти",
    ),
});
const genServicesSchema = z.object({
  title: z.string().optional(),
  items: z.array(genServiceItemSchema).min(1),
});

// Story (switchback) rows cast their photo by id too — REQUIRED per row: the
// zig-zag renders its image unconditionally, so a row without a real photo is
// dropped in assemble(). Reachable only when the wireframe registers the story
// section as variants-capable (see UNREACHABLE_TYPES).
const genSwitchbackItemSchema = switchbackItemSchema.omit({ imageUrl: true }).extend({
  photoId: z
    .string()
    .describe("id фото з медіа-інвентаря (наСайт:так) для цього рядка — рядок без валідного фото буде видалений"),
});
const genSwitchbackSchema = z.object({
  title: z.string().optional(),
  items: z.array(genSwitchbackItemSchema).min(1),
});

const genBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), props: genHeroSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("switchback"), props: genSwitchbackSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("services"), props: genServicesSchema, section: sectionField, variant: variantField }),
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
  // Atmospheric image subjects proposed by the model FOR THIS business — one
  // per image we may generate. §4.8's suffix and palette are appended in code,
  // so the honesty bounds never depend on the model remembering them.
  //
  // A LIST, not one string: the batch used to re-shoot a single subject with
  // four camera "twists", which varies the framing and not the content — five
  // near-identical pictures, which is exactly what owners reported («картинки
  // майже однакові»). Different images need different SUBJECTS.
  imageSubjects: z.array(z.string().max(140)).max(6).optional(),
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

/** One shipped section of the assembled page — what actually renders. */
export type ShippedSection = { section: string; variant?: string };

export interface GeneratedSite {
  blocks: StoredBlock[];
  // Always the wireframe; kept on the shape because the render path and the
  // editor still resolve a template to get its section components.
  templateId: string;
  imageSubjects?: string[];
  // Model-written page meta (D1) — persisted with the page content (draft →
  // published), consumed by generateMetadata/OG/JSON-LD on the public render.
  seo?: { title?: string; description?: string };
  /** The POST-assembly composition truth (force-injections and drops
   *  included), in page order. Pipeline v2 §3-S3 reconcile: overwrite
   *  designSpec.sectionPlan with this before persisting, so S4 never punishes
   *  legitimate plan/assembly divergence. */
  shippedPlan: ShippedSection[];
}

/**
 * Block types the composition pipeline CANNOT ship, and therefore must not
 * advertise (plan §4, wave D — «спалені слоти»). V3 connect-or-delete DECISION
 * (spec §5/§11-V3):
 *
 *  - `richText` — DELETED from the generation surface for good: no wireframe
 *    section renders it, none is planned, and marketing prose already lives in
 *    the structured blocks. The schema stays a STORED block type for manual
 *    editor use only; there is no richText arm in genBlockSchema, so the model
 *    cannot produce one even by accident.
 *  - `switchback` — CONNECTED, conditionally: the gen union carries a
 *    photoId-cast arm (genSwitchbackSchema — the free-form per-row `imageUrl`
 *    that burned this slot is gone), and assemble() casts/drops rows
 *    deterministically. It becomes reachable ONLY once the wireframe registers
 *    the `story` section as variants-capable — the runtime registry read below
 *    is the coordination point with the parallel wireframe session: this
 *    module must work against BOTH the pre-V3 wireframe (story unstyled, type
 *    stays burned) and the post-V3 one (variants registered, type opens up).
 *
 * One list, read by both prompt docs and the drop filter — so the state of
 * either block is one entry, not three call sites. Exported for the S1
 * capabilities doc (lib/ai/design-brief.ts): a section fed by an unreachable
 * type must not be PLANNED either.
 */
export function computeUnreachableTypes(template: SiteTemplate | undefined): Set<BlockType> {
  const types = new Set<BlockType>(["richText"]);
  const storyConnected = Boolean(
    template &&
      Object.values(template.sections).some(
        (def) => def.block === "switchback" && Object.keys(def.variants ?? {}).length > 0,
      ),
  );
  if (!storyConnected) types.add("switchback");
  return types;
}
export const UNREACHABLE_TYPES: ReadonlySet<BlockType> = computeUnreachableTypes(
  getTemplate(WIRE_TEMPLATE_ID),
);

function buildLibraryDoc(): string {
  return (Object.keys(blockLibrary) as BlockType[])
    // autoInjected blocks (lead_form) are added by code, never offered to the model.
    .filter((t) => !blockLibrary[t].autoInjected)
    .filter((t) => !UNREACHABLE_TYPES.has(t))
    .map((t) => {
      const e = blockLibrary[t];
      // The item floor is advertised with its CONSEQUENCE, because that is what
      // it is in code (blockLibrary.minItems/belowMin → meetsItemFloor): a grid
      // of one reads as a bug, so below the floor the section is either dropped
      // or re-laid-out — never padded with invented items.
      const floor = e.minItems
        ? ` МІНІМУМ ${e.minItems} пункт(и)${
            e.belowMin === "drop"
              ? " — інакше код прибирає секцію цілком (не добирай пунктів вигадкою)"
              : e.belowMin === "keep"
                ? " — з одним пунктом секція лишиться, але код подасть її іншим макетом (не вигадуй другого пункту заради сітки)"
                : ""
          }.`
        : "";
      return `- ${t} (${e.label}; роль: ${e.role}; макс ${e.maxPerPage}× на сторінку): ${e.description}${floor}`;
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
      // The repeat licence is the section's OWN flag, advertised so the model
      // never has to guess which sections may appear twice (§5 repeat-cap).
      const rep = def.repeatable ? " [можна двічі]" : "";
      return `· ${id} — ${def.label}: ${def.description} (блок ${def.block})${vs}${rep}`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Does the wireframe register a photo-capable services layout? Detected by
 *  variant NAME (the V3 contract with the wireframe session: the services
 *  photo layout is registered as `cards-with-photo` — any id carrying «photo»
 *  matches, so a rename doesn't silently mute the casting rule). */
function servicesPhotoVariants(template: SiteTemplate): string[] {
  return Object.values(template.sections)
    .filter((def) => def.block === "services")
    .flatMap((def) => Object.keys(def.variants ?? {}))
    .filter((v) => /photo/i.test(v));
}

function buildSystem(vertical: VerticalConfig, template: SiteTemplate): string {
  // The page is composed against a single structural wireframe; its surface is
  // written by a second call (lib/design/wire-style.ts). Nothing about the LOOK
  // is decided here, so the rules below are purely about composition and copy.
  const templateRule = `СЕКЦІЇ: компонуй сторінку ЛИШЕ із секцій, перелічених у повідомленні нижче. Правила:`;
  // Casting rules exist only for slots the CURRENT wireframe can render —
  // advertising a cast the registry can't show would burn tokens on photos
  // that never appear (same economy as UNREACHABLE_TYPES).
  const servicesCastRule = servicesPhotoVariants(template).length
    ? `- services: items[].photoId — ЛИШЕ коли обираєш фото-макет послуг (layout зі словом photo) і в інвентарі є якісне фото САМЕ цієї послуги; інакше пропусти — картки без фото це норма. Фото для команди підставляє код.`
    : `- Фото для послуг/команди підставляє код — не вигадуй їх.`;
  const storyCastRule = UNREACHABLE_TYPES.has("switchback")
    ? ""
    : `\n- story (зиг-заг): КОЖЕН рядок мусить мати items[].photoId (наСайт:так) — рядок без валідного фото видаляє код; обирай story лише коли є 2–3 РІЗНІ якісні фото для рядків.`;
  return `Ти — досвідчений веб-дизайнер і копірайтер, що збирає односторінковий сайт українському бізнесу: ${vertical.label} (${vertical.personaHint}).
Тон і акценти: ${vertical.genHint}.
Ти НЕ пишеш HTML. Ти КОМПОНУЄШ сторінку з фіксованої бібліотеки блоків: обираєш, які блоки і в якому порядку, і заповнюєш їхній вміст. Виклич інструмент build_site.

ПРАВИЛА КОМПОЗИЦІЇ (обов'язкові):
- Перший блок — завжди hero. Останній — завжди contacts.
- Між ними — від ${COMPOSITION_RULES.minMiddle} до ${COMPOSITION_RULES.maxMiddle} блоків із бібліотеки; набір і порядок обираєш під конкретний бізнес.
- Не використовуй жоден тип блоку частіше за його ліміт "макс ×". (На сайті-ШАБЛОНІ цей ліміт діє на СЕКЦІЮ, а не на тип блоку — РІЗНІ секції можуть мати однаковий тип; див. правила шаблону нижче.)
- Якщо тип дозволено двічі (напр. services) і контенту справді багато — два блоки МУСЯТЬ мати різні заголовки й різний зміст (основні / додаткові), ніколи не дублюй той самий список.
- Різні бізнеси мають отримувати РІЗНІ набори й порядок блоків — не роби однаковий шаблон.
- СЕКЦІЯ-СІТКА З ОДНИМ ПУНКТОМ — це помилка верстки, а не мінімалізм. Дотримуйся «МІНІМУМ N пунктів» із бібліотеки: не бери секцію, для якої маєш менше пунктів, і НІКОЛИ не добирай пункти вигадкою (вигаданий «другий тренер» гірший за одну чесну картку — код сам подасть її правильним макетом).

GROUNDING (критично для довіри):
- Факти — назва, телефон, адреса, години, ціни й назви послуг, відгуки — копіюй ТОЧНО з блоку «ПІДТВЕРДЖЕНІ ВЛАСНИКОМ ФАКТИ». НЕ вигадуй і не змінюй їх.
- Усе в <scraped_data> (біо, підписи, OCR, контакти-кандидати) — СИРОВИНА для тону, підписів і фото-кастингу, а НЕ факти: НІКОЛИ не переноси звідти телефони/адреси/email/години у реквізити сайту. Реквізити — лише з підтверджених фактів.
- ЗАБОРОНЕНО вигадувати: числа й відсотки, роки досвіду, кількість клієнтів/учнів/замовлень, ціни, тривалості, дати, адреси, освіту, сертифікати, звання, нагороди, гарантії результату, відгуки й імена людей. Якщо цього немає у підтверджених фактах — цього немає на сайті. НІКОЛИ не вигадуй числа у stats.
- ЗАБОРОНЕНО вигадувати і САМ ПЕРЕЛІК: послуги, напрямки, формати роботи, райони обслуговування, кого приймаєте і як працює графік. Це ФАКТИ, а не тон. Якщо у фактах дві послуги — на сайті дві, а не «щоб було більше».
- ДОЗВОЛЕНО і ПОТРІБНО: правдиві речення про ПРОЦЕС і про те, що вже є у фактах — «розкажемо, як усе відбувається, до початку роботи», «на заявку відповімо у месенджері», «покажемо варіанти й порадимо, що підійде». Це не вигадка, це чесний опис того, як ви працюєте. А от обіцянки про ОБСЯГ послуги (кого беремо, який рівень, який графік) або регалії — «10 років досвіду», «понад 500 клієнтів», «сертифікований майстер» — вигадка, якщо цього немає у фактах.
- Перевір себе перед кожним реченням: чи можу я показати, звідки це? Якщо джерело — лише моя уява, перепиши речення про підхід замість конкретики.
- Маркетинговий текст (заголовки, слогани, описи, заклики) — пиши сам, тепло, живою українською, доречно для ніші.
- Не вигадуй посилань на зображення.
- ЦІНИ: якщо у послуг НЕМАЄ цін у фактах — не залишай порожніх прайс-колонок і не пиши плейсхолдери («грн», «від …», «—»): подай послуги описово, без цінової сітки. Ціни, які Є у фактах, копіюй 1:1.

ГЛИБИНА КОНТЕНТУ (мало вхідних даних ≠ порожній сайт):
- Навіть коли фактів мало, сторінка мусить бути ЗМІСТОВНОЮ: ${COMPOSITION_RULES.minMiddle}–${COMPOSITION_RULES.maxMiddle} середніх секцій, кожна з реальною користю для відвідувача. Три сухі секції — це не «мінімалізм», це недороблений сайт.
- Коли даних обмаль, бери секції, які живуть із ЧЕСНОЇ ПРОЗИ (послуги з розгорнутими описами, як усе відбувається, питання-відповіді, переваги, заклик до дії), а не ті, що вимагають фактів, яких немає (цифри, преса, відгуки).
- Обсяг: послуги — РІВНО стільки позицій, скільки послуг/напрямків є у фактах (не більше; максимум 6, якщо їх справді більше). Глибина йде в ОПИС кожної — 2–3 речення про те, як це відбувається і для кого, — а НЕ в кількість позицій. Питання-відповіді — стільки справжніх запитань, на які факти дають відповідь (орієнтир 4–6, але 3 чесних краще за 6 вигаданих); кроки — 3–5; переваги — 4–8 тез.
- Hero-підзаголовок — 1–2 повні речення про суть і користь, а не три слова. Заклик до дії пояснює, ЩО станеться після заявки.
- Пиши для людини, яка вперше чує про цей бізнес: що це, для кого, як почати, чого очікувати.

БРЕНД-ГОЛОС (пиши як ЦЕЙ бізнес, не «як усі»):
- Виведи тон із блоку БРЕНД-ГОЛОС, реальних підписів постів і дослівних слів власника: переймай їхню лексику, улюблені слова, міру теплоти чи стриманості.
- Якщо дано стем нікнейму — можеш ОБЕРЕЖНО утворити з нього теплу форму звертання чи внутрішнє слівце бренду (напр. lapusi → «лапусики»), якщо це пасує тону.
- Якщо дано орієнтир (вулиця/метро) — згадай його природно один раз (напр. у контактному чи hero-тексті).

ЯКІСТЬ ТЕКСТУ (анти-повтори й анти-штампи):
- Фірмова фраза бренду (слівце власника, обіграний нікнейм, «фішка») звучить 1–2 рази на сторінку й не у двох сусідніх секціях. Далі ту саму думку кажи ІНШИМИ словами.
- Жодне помітне словосполучення (2+ слова) не повторюється дослівно у двох секціях — надто між описами послуг і FAQ: FAQ ДОДАЄ нове (умови, «а що як», деталі процесу), а не переказує секції вище. Виняток — обов'язкові повтори: назва бізнесу, місто й назви послуг із фактів; їх повторюй стільки, скільки вимагають правила SEO.
- Повна адреса (вулиця з номером) у ПРОЗІ — максимум один раз на сторінку; у contacts і map її подає код, там це не повтор.
- eyebrow — не переказ title, а ІНША вісь, узята з ПІДТВЕРДЖЕНИХ фактів: кому / коли / звідки («Щоранку з 8:00» — лише якщо ці години є у фактах). Якщо eyebrow і title кажуть одне й те саме — перепиши eyebrow, а не видаляй.
- Регістр — той, яким пише сам власник. Поза його словами не додавай сленгу («на районі», «вайб») і рекламних кальок («X про Y», «твій ідеальний»).
- Кожне речення несе факт, дію або пояснення; тавтологія («зранку чи ввечері — однаково смачно») — вода, викинь її. Це НЕ привід писати менше за обсяги з ГЛИБИНИ КОНТЕНТУ: глибина йде через нову інформацію, не через повтор.

ФОТО-КАСТИНГ (за id — URL ти не бачиш, їх підставляє код):
- У <scraped_data> є медіа-інвентар: id, тип, опис, підпис, OCR. Кастуй ЛИШЕ фото з позначкою наСайт:так.
- hero.photoId — ОДНЕ найатмосферніше / найзагальніше фото як фон першого екрана.
- У gallery обери решту придатних фото (images[].photoId) і дай кожному короткий title на основі РЕАЛЬНОГО підпису/опису (category — коли доречно). НЕ вигадуй id і не описуй того, чого не видно.
${servicesCastRule}${storyCastRule}

${templateRule}
- Для КОЖНОГО блоку вкажи section = id секції шаблону; тип блоку має відповідати вказаному («блок X»).
- Якщо секція має layout-варіанти [layout: default | …] — обери variant, що найкраще пасує цьому бізнесу; якщо не впевнений, не вказуй — макет обере код.
- HERO має РІВНО три макети, обирай свідомо під бізнес і під ФОТО:
  · split — текст ліворуч, фото праворуч. Універсальний; бери, коли фото важливе, але не самодостатнє (прайс-орієнтований бізнес, багато тексту).
  · mirror — те саме дзеркально, фото ліворуч. Коли фото має вести око першим (візуальні ніші: квіти, кондитерська, б'юті).
  · banner — фото на весь екран тлом, світлий текст по центру. Найсильніший, але ЛИШЕ якщо в медіа-інвентарі є фото з високою «якість:N/10» і БЕЗ позначки «текст поверх фото» (ідеально — з «годиться на банер»). Слабке, темне чи «текстове» фото на весь екран виглядає гірше за будь-який інший макет — тоді бери split або mirror.
- hero-секція — перша, contacts-секція — остання; порядок — орієнтир, не догма.
- Кожну секцію зазвичай один раз. Якщо контенту СПРАВДІ багато — секцію можна використати ДВІЧІ (напр. послуги: основні + додаткові), але ЛИШЕ секцію з позначкою [можна двічі], і повтори МУСЯТЬ мати РІЗНІ variant і РІЗНІ заголовки — сусідні однакові макети виглядають як помилка верстки. РІЗНІ секції можуть живитись ОДНИМ типом блоку (ліміт «макс ×» діє на секцію, не на тип).

SEO-МЕТА (обов'язково заповни seo):
- seo.title — за формулою «{головна послуга} у {місто} — {назва}», до 60 символів. Головну послугу бери з фактів, місто — з фактів. Без міста у фактах — «{головна послуга} — {назва}».
- seo.description — 1–2 продаючі речення до 150 символів: що робить бізнес, для кого, у якому місті, і що зробити далі. Природною мовою, без лапок, без переліку через кому всіх послуг і без CAPS.

SEO В ТЕКСТАХ СТОРІНКИ (де він живе — і де його НЕ буває):
- SEO живе у ЗВ'ЯЗНОМУ ТЕКСТІ: у заголовках секцій, у перших реченнях описів, у формулюваннях питань FAQ і в seo-меті. Ключове слово має стояти всередині нормального речення, яке людина прочитає без відрази.
- Структура заголовків: hero — єдиний головний заголовок сторінки (H1) з головною послугою; заголовки секцій — це H2, і частина з них має нести ключову суть ніші («Тренування з тенісу для дорослих і дітей», «Ремонт ходової»), а не лише образ («Наша магія»). Образність — у підзаголовки й описи.
- ЗАБОРОНЕНО виносити ключові слова окремою секцією-«чіпами»: рядок на кшталт «Теніс · Tennis · Тенісльвів · Львів · Тренер з тенісу» — це видимий keyword stuffing. Він відлякує людей і шкодить пошуковим позиціям; код такі секції видаляє цілком. Секція переваг — це користь для клієнта фразами, а не хмара тегів.
- Місто згадай природно у 2–3 місцях сторінки (hero-підзаголовок, опис послуг, одна відповідь у FAQ) — НЕ в кожному заголовку, НЕ списком міст і НЕ склейками («Львівтеніс»).
- Жодних латинських чи транслітерованих дублів українських слів «для пошуку» — сторінка українською, і пошук це розуміє.

ЗОБРАЖЕННЯ: заповни imageSubjects — ДО 5 РІЗНИХ сюжетів АНГЛІЙСЬКОЮ (кожен до 15 слів) для фонових зображень цього бізнесу. Перший піде в hero, решта — в галерею.
- Вони мають бути РІЗНІ ПО ЗМІСТУ, а не один сюжет під різними ракурсами: різні предмети, матеріали, поверхні, пора дня. Один сюжет, знятий п'ять разів, дає п'ять майже однакових картинок — власники скаржаться саме на це.
- Кожен сюжет — конкретний предмет цієї справи, узятий із зібраних фактів: грумінг маленьких порід → "small fluffy dog after grooming, soft warm light"; пекарня на заквасці → "rustic sourdough loaf crust close-up"; теніс → "clay court surface and tennis ball in low sun". Не вигадуй асортименту, якого в них немає.
- Це ФОН, а не портфоліо: зображення ніколи не подається як «наша робота» (за це відповідає код).
- ЗАБОРОНЕНО: люди й обличчя, будь-який текст/ціни/логотипи, приміщення, фасади й вітрини, які можна прийняти за їхнє реальне місце.
Приклад для хімчистки: ["soft folded fresh linen textures in airy light", "steam rising over a pressed collar, backlit", "row of garment covers in shallow focus", "detergent foam macro on white fabric", "wooden hangers against a pale wall"].`;
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
} as unknown as LlmTool;

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
  // The validated S1 design brief (pipeline v2 §3). When present: positioning
  // rides the prompt, sectionPlan becomes the composition DEFAULT (deviations
  // only within registered variants of planned sections — enforced by
  // assemble), and budgetHint drives the deterministic char clamps. Absent →
  // exactly the v1 behaviour.
  designSpec?: DesignSpec,
  // Per-section seeded rolls (spec §4 «варіанти секцій», axis `variant:<id>`):
  // uniform [0, 1) per section id, consumed only for a variant-capable section
  // the model AND the plan left on the default layout. A FUNCTION rather than
  // a rolls map so the caller doesn't have to enumerate registry sections —
  // the pipeline passes `(id) => rollAxis(host, nonce, `variant:${id}`)`.
  // The SECOND instance of a repeatable section is rolled with `<id>:2` so
  // the two instances draw from distinct streams (the first keeps the bare id
  // — existing tenants' rolls stay byte-identical).
  // Absent → no seeded fallback for non-hero sections (today's behaviour).
  sectionVariantRoll?: (sectionId: string) => number,
): Promise<GeneratedSite> {
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
  // byte-stable per vertical, the volatile per-business parts (design brief,
  // dossier) LAST.
  const briefDoc = designSpec ? `${buildDesignBriefDoc(designSpec)}\n\n` : "";
  // Prompt caching (2026-08-10): the library + section docs are byte-identical
  // for every generation on a deploy — they lead the user turn with a cache
  // breakpoint, so tools + system + docs read at 0.1× across tenants (one
  // cache entry per vertical, since the system prompt varies by vertical).
  // The brief + dossier vary per business and stay outside the cached prefix.
  const staticDocs = `Бібліотека блоків:
${buildLibraryDoc()}

Секції, з яких компонується сторінка:
${buildSectionDoc(template)}`;
  const dynamicPrompt = `${briefDoc}${formatDossierForPrompt(dossier)}

Збери сайт за правилами вище і виклич build_site.`;

  const res = await llmCreate({
    model: GEN_MODEL,
    max_tokens: 20000,
    // Luna + high reasoning (owner call 2026-08-19). tool_choice stays "auto";
    // a missing tool call is a hard failure below (no retry).
    effort: "high",
    // Belt at the API boundary: the dossier carries emoji-heavy scraped text —
    // a lone surrogate anywhere in the body is a hard 400 (§lib/ai/sanitize).
    system: stripLoneSurrogates(buildSystem(vertical, template)),
    tools: [buildSiteTool],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        // Static docs lead the message — OpenAI's automatic prompt caching
        // keys on the stable prefix (no markup needed).
        content: [
          { type: "text" as const, text: stripLoneSurrogates(staticDocs) },
          { type: "text" as const, text: stripLoneSurrogates(dynamicPrompt) },
        ],
      },
    ],
    // One attempt IS the 120s S2б stage budget — a second full composition
    // can't fit, so a transient failure goes straight to the honest-error path.
    signal,
  });

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

  const blocks = assemble(
    parsed.data.blocks,
    facts,
    media,
    template,
    dossier,
    variantSeed,
    designSpec?.sectionPlan,
    sectionVariantRoll,
  );
  return {
    templateId: template.id,
    blocks,
    shippedPlan: shippedSectionPlan(blocks),
    imageSubjects: parsed.data.imageSubjects,
    seo: clampSeo(parsed.data.seo),
  };
}

/**
 * The S1 brief rendered for the COPYWRITER call (positioning + the section
 * plan as the composition default). Deviation contract mirrors the code-side
 * enforcement in assemble(): skipping a planned section or picking another
 * registered variant is allowed; sections OUTSIDE the plan get dropped, so the
 * prompt says so honestly.
 */
function buildDesignBriefDoc(spec: DesignSpec): string {
  const pos = spec.positioning;
  const lines: string[] = ["ДИЗАЙН-БРИФ ЦЬОГО САЙТУ (узгоджений перед композицією):"];
  if (pos.promise) lines.push(`- Обіцянка бренду (веди сторінку від неї): «${pos.promise}»`);
  if (pos.painPoints.length)
    lines.push(`- Болі клієнта, на які відповідає сторінка: ${pos.painPoints.join("; ")}`);
  if (pos.tone) lines.push(`- Тон: ${pos.tone}`);
  if (pos.voiceNotes) lines.push(`- Голос: ${pos.voiceNotes}`);
  lines.push(
    "",
    "ПЛАН СЕКЦІЙ — плануй композицію ЗА ЦИМ ПЛАНОМ; відхиляйся лише з причини: можеш пропустити секцію, для якої справді нема контенту, чи обрати інший зареєстрований variant — але НЕ додавай секцій поза планом (код їх відкине). Форму заявки і контакти додає код — не плануй їх:",
    ...spec.sectionPlan.map((e, i) => {
      const v = e.variant ? ` [variant: ${e.variant}]` : "";
      const budget = e.budgetHint ? ` — обсяг: ${e.budgetHint}` : "";
      return `${i + 1}. ${e.section}${v}${budget}`;
    }),
  );
  return lines.join("\n");
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
  // A photo OF A PERSON that the vetting pass did not mark as banner-capable is
  // the exact shape that broke on the live site (owner feedback 2026-08-10): a
  // portrait cast full-bleed into the widest, shortest box on the page gets
  // `cover`-cropped through the face. `heroCandidate` is the vision layer's own
  // «survives a full-width banner» verdict, so an unrated portrait keeps the
  // benefit of the doubt only when nothing says otherwise.
  if (meta?.kind === "person" && meta.heroCandidate !== true) return false;
  return photoScore(meta) >= USABLE_SITE_QUALITY;
}

/**
 * Crop anchor for the hero photo — `hero.imageFocus`, a CSS `object-position`
 * value the wireframe puts on `--wire-hero-focus`. Derived HERE, from the
 * vetting metadata the vision pass already writes, because the model never sees
 * the photo and the renderer has nothing but the URL.
 *
 * Only two signals are honest enough to act on:
 *  - `kind: "person"` → faces sit in the upper third far more often than not,
 *    so bias the kept band up;
 *  - `subjectCentered` → the vision pass says the subject reads clearly and is
 *    not cropped at the edges, i.e. dead centre IS the right anchor.
 * Anything else returns undefined and the wireframe's own 50% 38% default (also
 * biased up, but gently) applies. No saliency box exists yet — when one does,
 * it replaces this function and nothing else changes.
 */
export function heroFocusFor(meta: PhotoMeta | undefined): string | undefined {
  if (!meta) return undefined;
  if (meta.kind === "person") return "50% 30%";
  if (meta.subjectCentered === true) return "50% 50%";
  return undefined;
}

/**
 * How many instances of one section a page may carry (pipeline v2 §5): the
 * explicit `repeatable` flag is the ONLY licence to repeat. It used to be
 * «has alternate layouts», which silently made every variant-capable section
 * repeatable — with the V3 variant sections that rule would have meant two
 * CTA bands on one page. Variants still matter for making the two instances
 * LOOK different (the reassignment pass in assemble), they just no longer
 * grant the repeat itself. Exported for vitest.
 */
export function sectionRepeatCap(def: TemplateSectionDef | undefined): number {
  return def?.repeatable === true ? 2 : 1;
}

/**
 * Uniform roll in [0, 1) → a section's layout id (or undefined = the default
 * layout) — the GENERIC arm of the seeded variant fallback (spec §4 axis
 * `variant:<sectionId>`), applied only when neither the model nor the S1 plan
 * named a layout. Same reason as the hero's seeded roll: an empty choice that
 * always lands on the default is how every site converged on one look.
 *
 * The pool includes the unnamed default — UNLESS the section registers its
 * default under a name too (the hero pattern: `variants.split === component`),
 * in which case the named ids already cover every layout and adding undefined
 * would double-count it. Wireframe authors should PREFER the hero pattern so
 * audits and stored content can always name the layout they mean.
 *
 * Hero itself never routes through here — its variant resolves at conversion
 * (photo veto + the legacy `variant` purpose stream, a reproducibility
 * contract with existing tenants).
 */
export function sectionVariantForRoll(
  def: TemplateSectionDef | undefined,
  roll: number,
  // Per-variant precondition (V3 §5): a layout the BLOCK cannot honour must
  // not be rollable — e.g. `cards-with-photo` on a services block whose items
  // carry no photos renders as the plain grid, silently collapsing the axis.
  // Excluding everything leaves the (unnamed) default.
  exclude?: (variantId: string) => boolean,
): string | undefined {
  const ids = Object.keys(def?.variants ?? {}).filter((id) => !exclude?.(id));
  if (!def?.variants || ids.length === 0) return undefined;
  const namesDefault = Object.values(def.variants).includes(def.component);
  const pool: (string | undefined)[] = namesDefault ? ids : [undefined, ...ids];
  const t = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 1 - 1e-9) : 0;
  return pool[Math.floor(t * pool.length)];
}

/**
 * C1/C4 safety net (v2 §5): a repeated section must never repeat the SAME
 * layout — the prompt asks for different variants, but a model slip would
 * render two identical-looking sections (reads as a bug). Deterministic
 * reassignment: the later instance gets the first layout the section hasn't
 * used yet.
 *
 * The option list is CANONICALIZED over the hero pattern: when a section
 * registers its default under a name (`variants.grid === component`, as
 * services/gallery/testimonials all do), `undefined` and that name are the
 * same component — offering `undefined` as a "different" layout would ship
 * two visually identical sections, the exact failure this net exists to
 * prevent. Same check as sectionVariantForRoll's pool. A repeatable section
 * with no (or exhausted) variants keeps the default — repeats and variants
 * are decoupled (§5), so the flag owner should pair `repeatable` with
 * registered variants. Exported for vitest.
 */
export function reassignRepeatedLayouts(
  placed: StoredBlock[],
  template: SiteTemplate,
): StoredBlock[] {
  const out = [...placed];
  const usedLayouts = new Map<string, Set<string>>();
  for (let i = 0; i < out.length; i++) {
    const sb = out[i];
    // Hidden blocks don't render/number — skip them so the pass keeps
    // matching PageRenderer semantics if it's ever reused on stored content
    // (generation itself always emits hidden:false).
    if (!sb.section || sb.hidden) continue;
    const used = usedLayouts.get(sb.section) ?? new Set<string>();
    usedLayouts.set(sb.section, used);
    if (used.has(sb.variant ?? "")) {
      const def = template.sections[sb.section];
      const ids = Object.keys(def?.variants ?? {});
      const namesDefault = def ? Object.values(def.variants ?? {}).includes(def.component) : false;
      const options: (string | undefined)[] = namesDefault ? ids : [undefined, ...ids];
      out[i] = { ...sb, variant: options.find((v) => !used.has(v ?? "")) };
    }
    used.add(out[i].variant ?? "");
  }
  return out;
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
// sectionPlan enforcement (pipeline v2 §3): the S1 plan is MANDATORY for the
// composition — S2а styles against it, so a model block whose section the plan
// never named would be a composition-phantom. Applied to MODEL blocks BEFORE
// the force-injections (invariant 8 stays whole: lead_form/contacts/gallery
// are code's, legitimately outside any plan). All helpers are pure + exported
// for vitest.
// ---------------------------------------------------------------------------

/** Types the plan gate never touches: hero/contacts are structural bookends
 *  the assembly synthesizes or force-keeps, lead_form/gallery are injected. */
const PLAN_EXEMPT_TYPES = new Set<BlockType>(["hero", "contacts", "lead_form", "gallery"]);

/**
 * Drop model-authored blocks whose resolved section is OUTSIDE the plan.
 * No plan / no template → identity (v1 path). Typed structurally so it runs on
 * GENERATION blocks (before id→URL conversion) — enforcement must see exactly
 * what the model authored, nothing the code added.
 */
export function enforceSectionPlan<T extends { type: BlockType; section?: string }>(
  blocks: T[],
  plan: readonly SectionPlanEntry[] | undefined,
  template: SiteTemplate | undefined,
): T[] {
  if (!template || !plan?.length) return blocks;
  const planned = new Set(plan.map((p) => p.section));
  const filtered = blocks.filter((b) => {
    if (PLAN_EXEMPT_TYPES.has(b.type)) return true;
    const section = resolvedSection(template, b);
    return section !== undefined && planned.has(section);
  });
  // Minimum-content floor (review must-fix): validateDesignSpec only
  // guarantees ≥1 KNOWN section, and hero/gallery/contacts/lead_form are
  // plan-exempt — so a schema-valid plan like [hero, gallery] would strip
  // every content section and ship a page of bookends. When enforcement would
  // remove ALL non-exempt model blocks, the plan — not the composition — is
  // the phantom: keep the model's composition for this run. Known degradation:
  // those out-of-plan sections were also cut from the slimmed S2а stylist
  // prompt (wire-style plannedBlockTypes), so they render on wire.css alone
  // until the S4 corrective regen — which reads the reconciled shippedPlan —
  // restyles them.
  const hadContent = blocks.some((b) => !PLAN_EXEMPT_TYPES.has(b.type));
  const keptContent = filtered.some((b) => !PLAN_EXEMPT_TYPES.has(b.type));
  if (hadContent && !keptContent) {
    console.warn(
      "[generate] sectionPlan enforcement skipped: the plan would strip every content section",
    );
    return blocks;
  }
  return filtered;
}

/**
 * The plan's variant as the DEFAULT layout: fills only blocks the model left
 * without a (valid) variant — a model's explicit registered choice is a
 * legitimate deviation and always wins. First plan entry per section wins;
 * unregistered plan variants are ignored (validateDesignSpec already degraded
 * them, this is the seatbelt). Hero is untouched here: its variant is always
 * resolved at conversion (photo veto + seeded fallback).
 */
export function applyPlanVariantDefaults(
  blocks: StoredBlock[],
  plan: readonly SectionPlanEntry[] | undefined,
  template: SiteTemplate | undefined,
): StoredBlock[] {
  if (!template || !plan?.length) return blocks;
  const defaults = new Map<string, string>();
  for (const entry of plan) {
    if (!entry.variant || defaults.has(entry.section)) continue;
    if (template.sections[entry.section]?.variants?.[entry.variant]) {
      defaults.set(entry.section, entry.variant);
    }
  }
  if (defaults.size === 0) return blocks;
  return blocks.map((b) => {
    if (b.variant !== undefined || !b.section) return b;
    const v = defaults.get(b.section);
    return v ? { ...b, variant: v } : b;
  });
}

/** The post-assembly composition truth (visible placed blocks, page order) —
 *  what the pipeline writes BACK into designSpec.sectionPlan (§3 reconcile). */
export function shippedSectionPlan(blocks: readonly StoredBlock[]): ShippedSection[] {
  const out: ShippedSection[] = [];
  for (const b of blocks) {
    if (!b.section || b.hidden) continue;
    out.push({ section: b.section, ...(b.variant && { variant: b.variant }) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// charBudget clamps (pipeline v2 §3-S3): budgetHint is consumed HERE, as a
// deterministic post-clamp on the block's primary text fields — clampSeo's
// pattern, never zod .max (overshoot must not drop a block). Only the compact
// family of hints clamps; «розгорнуто» and friends are prompt-side guidance
// the model already followed.
// ---------------------------------------------------------------------------

const COMPACT_HINT_RE = /стисл|коротк|лаконі|мінімал/i;

/** Compact-tier ceilings per field kind (chars). Generous vs what «стисло»
 *  should have produced — the clamp is a seatbelt, not the writer. */
const COMPACT_CAPS = {
  title: 70,
  subtitle: 160,
  itemText: 140,
  answer: 260,
} as const;

/** Word-boundary truncation, surrogate-safe (visible copy — unlike clampSeo's
 *  metadata, a mid-word cut here would read as a rendering bug). */
function clampText(s: string, max: number): string {
  if (s.length <= max) return s;
  let cut = safeSlice(s, max);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  return `${cut.replace(/[\s,.;:…—–-]+$/u, "")}…`;
}

/** Contact-shaped material (handles, e-mails, URLs) — mirrors the fact-gate's
 *  CONTACT_RE shape; by clamp time every surviving contact token is grounded. */
const CONTACT_SHAPE_RE = /@[a-z0-9_.]{3,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:https?:\/\/|www\.)\S+/i;

/**
 * True when the copy carries confirmed-fact material: a digit run that matches
 * the facts corpus (hours, prices, addresses — by clamp time the fact gate has
 * already stripped ungrounded numerals, so a corpus hit IS a requisite) or a
 * contact-shaped token. Truncating such a string can turn a true fact into a
 * false one («…пн–пт 9:00–18:00, сб 10:00–…») — worse than the length
 * overshoot the clamp guards, so fact-bearing copy ships unclamped and the
 * budgetHint stays prompt-side guidance there (invariant 5).
 */
function carriesFactMaterial(s: string, corpus: FactsCorpus | undefined): boolean {
  if (!corpus) return false;
  if (CONTACT_SHAPE_RE.test(s)) return true;
  for (const run of s.match(/\d+/g) ?? []) {
    if (corpus.digitRuns.has(run)) return true;
  }
  return false;
}

/** Clamp ONE block's primary text fields to the compact tier. Quotes are
 *  exempt everywhere: testimonial text is a customer's real words (a fact) —
 *  truncating testimony would change what someone said. Fact-bearing strings
 *  (see carriesFactMaterial) are exempt too. */
function clampBlockText(b: StoredBlock, corpus: FactsCorpus | undefined): StoredBlock {
  const clampSafe = (s: string, max: number): string =>
    carriesFactMaterial(s, corpus) ? s : clampText(s, max);
  const clampOpt = (s: string | undefined, max: number): string | undefined =>
    s === undefined ? undefined : clampSafe(s, max);
  switch (b.type) {
    case "hero":
      return {
        ...b,
        props: {
          ...b.props,
          title: clampSafe(b.props.title, COMPACT_CAPS.title),
          subtitle: clampOpt(b.props.subtitle, COMPACT_CAPS.subtitle),
        },
      };
    case "services":
      return {
        ...b,
        props: {
          ...b.props,
          title: clampOpt(b.props.title, COMPACT_CAPS.title),
          items: b.props.items.map((it) => ({
            ...it,
            description: clampOpt(it.description, COMPACT_CAPS.itemText),
          })),
        },
      };
    case "cta":
      return {
        ...b,
        props: {
          ...b.props,
          title: clampSafe(b.props.title, COMPACT_CAPS.title),
          subtitle: clampOpt(b.props.subtitle, COMPACT_CAPS.subtitle),
        },
      };
    case "faq":
      return {
        ...b,
        props: {
          ...b.props,
          items: b.props.items.map((it) => ({
            ...it,
            answer: clampSafe(it.answer, COMPACT_CAPS.answer),
          })),
        },
      };
    case "timeline":
      return {
        ...b,
        props: {
          ...b.props,
          items: b.props.items.map((it) => ({
            ...it,
            subtitle: clampOpt(it.subtitle, COMPACT_CAPS.itemText),
            description: clampOpt(it.description, COMPACT_CAPS.itemText),
          })),
        },
      };
    case "team":
      return {
        ...b,
        props: {
          ...b.props,
          items: b.props.items.map((it) => ({
            ...it,
            bio: clampOpt(it.bio, COMPACT_CAPS.itemText),
          })),
        },
      };
    default:
      return b;
  }
}

/**
 * Apply the plan's budget hints to the assembled page: every visible block
 * whose section carries a compact hint gets its primary text fields clamped.
 * Deterministic, pure, exported for vitest. No plan / no compact hints → the
 * exact same array back. `facts` (when given) builds the grounding corpus that
 * exempts fact-bearing strings — the clamp must never truncate a requisite.
 */
export function applyCharBudgets(
  blocks: StoredBlock[],
  plan: readonly SectionPlanEntry[] | undefined,
  facts?: unknown,
): StoredBlock[] {
  if (!plan?.length) return blocks;
  const compact = new Set<string>();
  for (const e of plan) {
    if (e.budgetHint && COMPACT_HINT_RE.test(e.budgetHint)) compact.add(e.section);
  }
  if (compact.size === 0) return blocks;
  const corpus = facts === undefined ? undefined : buildFactsCorpus(facts);
  return blocks.map((b) => (b.section && compact.has(b.section) ? clampBlockText(b, corpus) : b));
}

// ---------------------------------------------------------------------------
// Benefit strip hygiene — the rule itself now lives in lib/blocks/hygiene.ts,
// a dependency-free module, so the S4 QA rebuild and the wireframe's render
// guard can apply the SAME function (owner feedback 2026-08-10, item 4: the
// cleanup used to be assemble()-only, which left every already-generated site
// stuffed and let one QA round put the chips straight back). Re-exported here
// because this module is where the pipeline and its vitest suite import it.
// ---------------------------------------------------------------------------
export { cleanBenefitStrip, BENEFITS_TITLE };

// ---------------------------------------------------------------------------
// Item floors for list/grid sections (owner feedback 2026-08-10, item 5: «Наша
// тренерка» rendered a card GRID holding exactly ONE card). The numbers and the
// below-floor policy live in blockLibrary (one table, read by the prompt doc
// AND by this enforcement); the split of responsibility is:
//   - DATA rule (here): does the section ship at all, and with what item count.
//   - LAYOUT rule (wireframe): how a surviving single item is rendered —
//     the wireframe session owns the single-item render guard.
// Padding a short grid with invented items is never an option (invariant 5).
// ---------------------------------------------------------------------------

/** Item count of a block that renders a repeating list/grid; undefined for
 *  blocks that have no item array (hero, cta, contacts…). */
// itemCountOf + meetsItemFloor now live in lib/blocks/hygiene.ts (one module
// for every persist-time content rule); re-exported for the pipeline's vitest.
export { meetsItemFloor };

/**
 * Registered layouts that read correctly with a SINGLE item — the data-side
 * half of the single-item contract (the wireframe owns the render-side half).
 * Applied only when the section actually registers the id, so a wireframe
 * rename degrades to «keep the current layout», never to a broken variant.
 *
 * It overrides a model/seeded choice on purpose: a lone testimonial in a
 * three-card grid is a layout bug regardless of who picked the grid.
 */
const SINGLE_ITEM_VARIANTS: Partial<Record<BlockType, string>> = {
  testimonials: "big-quote",
  services: "list-rows",
};

/** Give every single-item block its single-friendly registered layout. Pure,
 *  runs last in the variant chain (after the repeat-layout safety net) so it is
 *  the final authority for these blocks. Exported for vitest. */
export function applySingleItemLayouts(
  blocks: StoredBlock[],
  template: SiteTemplate | undefined,
): StoredBlock[] {
  if (!template) return blocks;
  return blocks.map((b) => {
    const wanted = SINGLE_ITEM_VARIANTS[b.type];
    if (!wanted || b.variant === wanted || itemCountOf(b) !== 1) return b;
    if (!b.section || !template.sections[b.section]?.variants?.[wanted]) return b;
    // A single service that DID get a real photo cast is better served by the
    // photo layout it was cast for than by a bare price row.
    if (b.type === "services" && b.props.items.some((it) => it.imageUrl)) return b;
    return { ...b, variant: wanted };
  });
}

// ---------------------------------------------------------------------------
// Post-generation: cast photos id→URL, enforce composition, ground facts,
// project nav placement.
// ---------------------------------------------------------------------------
function assemble(
  rawInput: GenBlockInstance[],
  facts: BusinessFacts,
  media: SiteMedia | undefined,
  template: SiteTemplate | undefined,
  dossier: Dossier,
  variantSeed: number,
  plan?: readonly SectionPlanEntry[],
  sectionVariantRoll?: (sectionId: string) => number,
): StoredBlock[] {
  // sectionPlan gate FIRST — on the model's own blocks, before any conversion
  // or force-injection (§3: the order of enforcement is part of the contract).
  const raw = enforceSectionPlan(rawInput, plan, template);
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
  const genHero = raw.find((b) => b.type === "hero");
  const castHeroId = genHero?.type === "hero" ? genHero.props.photoId : undefined;
  const heroPhoto =
    (castHeroId ? urlById.get(castHeroId) : undefined) ?? pickHeroUrl(eligible, metaByUrl);
  // Page-wide photo budget (V3 §5): every slot that renders a photo draws from
  // ONE shared set. The hero seeds it, the services/story casts add to it, and
  // the gallery pool is derived AT THE POINT OF USE — never snapshotted — so
  // the same photo can't render as a service card AND a gallery tile, and a
  // second gallery instance pulls only photos the first didn't. First use wins
  // in document order (deterministic).
  const usedPhotos = new Set<string>(heroPhoto ? [heroPhoto] : []);
  const galleryPool = () => eligible.filter((u) => !usedPhotos.has(u));

  type StoredGalleryImage = { url: string; alt?: string; title?: string; category?: string };
  const galleryFromPool = (): StoredGalleryImage[] => {
    const pool = galleryPool();
    for (const u of pool) usedPhotos.add(u);
    return pool.map((url, i) => ({
      url,
      alt: photoAlt(url, `${altBase} — фото ${i + 1}`),
      ...(captionFor(url) && { title: captionFor(url) }),
    }));
  };
  // The model's cast list (валідні id, nothing already used elsewhere on the
  // page, deduped) wins — its titles/categories are the whole point of
  // casting. A cast that maps to <2 real photos is unusable → all remaining
  // unused photos, captions as titles. The cast's photos are committed to the
  // budget only when the cast is actually used, so a failed cast doesn't burn
  // them for the pool fallback.
  const galleryFromCast = (
    cast: { photoId: string; title?: string; category?: string }[],
  ): StoredGalleryImage[] => {
    const out: StoredGalleryImage[] = [];
    const local = new Set<string>();
    for (const item of cast) {
      const url = urlById.get(item.photoId);
      if (!url || usedPhotos.has(url) || local.has(url)) continue;
      local.add(url);
      out.push({
        url,
        alt: photoAlt(url, `${altBase} — фото ${out.length + 1}`),
        ...((item.title ?? captionFor(url)) && { title: item.title ?? captionFor(url) }),
        ...(item.category && { category: item.category }),
      });
    }
    if (out.length < 2) return galleryFromPool();
    for (const u of local) usedPhotos.add(u);
    return out;
  };

  // GENERATION → STORED conversion (03 §2.1): the id-cast arms become concrete
  // storage URLs here — deterministically, so nothing model-invented can ever
  // reach an image field. All other arms are structurally identical.
  const converted: BlockInstance[] = raw.map((b): BlockInstance => {
    if (b.type === "hero") {
      // imageFocus is CODE-owned (schema comment): drop whatever arrived and
      // derive it from the chosen photo's own metadata below.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { photoId: _photoId, imageFocus: _imageFocus, ...props } = b.props;
      const imageUrl = heroPhoto ?? generatedHero;
      const imageAlt = heroPhoto
        ? photoAlt(heroPhoto, altBase)
        : imageUrl
          ? `Атмосферне зображення — ${altBase}`
          : undefined;
      // Layout precedence: the model's choice → the S1 plan's hero variant →
      // the seeded roll. The `banner` photo veto applies to ALL paths — the
      // model (and the brief) are briefed on photo quality but must not be
      // trusted with it: a blurry or text-covered shot blown up full-bleed is
      // worse than any other layout. groundAndPlace re-validates either way.
      const heroMeta = heroPhoto ? metaByUrl.get(heroPhoto) : undefined;
      const imageFocus = heroPhoto ? heroFocusFor(heroMeta) : undefined;
      const allowBanner = bannerWorthy(heroMeta);
      const chosen = resolvedVariant(template, resolvedSection(template, b), b.variant);
      const planned = resolvedVariant(
        template,
        "hero",
        plan?.find((e) => e.section === "hero")?.variant,
      );
      const vetoed = (v: string | undefined) => (v === "banner" && !allowBanner ? undefined : v);
      const variant =
        vetoed(chosen) ?? vetoed(planned) ?? heroVariantForSeed(variantSeed, allowBanner);
      return {
        type: "hero",
        props: { ...props, imageUrl, imageAlt, ...(imageFocus ? { imageFocus } : {}) },
        section: b.section,
        variant,
      };
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
    if (b.type === "services") {
      // Services photo casting (V3 §5, cards-with-photo): the same id→URL door
      // as the gallery, drawing on the page-wide photo budget — only an
      // eligible inventory photo can land on a card, the hero background never
      // repeats here, one photo is never reused on a second card, and a photo
      // cast here is subtracted from the gallery's pool. An
      // unresolvable/duplicate id keeps the CARD and drops the PHOTO (cards
      // degrade to text; a casting slip must not cost a service). The stored
      // servicesSchema is unchanged — this arm only turns photoId into the
      // imageUrl the schema always had.
      const items = b.props.items.map((it) => {
        const { photoId, ...rest } = it;
        const url = photoId ? urlById.get(photoId) : undefined;
        if (!url || usedPhotos.has(url)) return rest;
        usedPhotos.add(url);
        return { ...rest, imageUrl: url };
      });
      return { type: "services", props: { ...b.props, items }, section: b.section, variant: b.variant };
    }
    if (b.type === "switchback") {
      // Story rows cast per-row photos by id — the reason this type was burned
      // pre-V3: a free-form imageUrl per row would be invented (§4.8). Unlike
      // services, the photo IS the row (the zig-zag renders it
      // unconditionally), so a row whose id doesn't resolve — or repeats a
      // photo already used anywhere on the page (hero, a service card,
      // another row) — is dropped whole; a story left with no rows is dropped
      // in the middle filter below. Draws on the same page-wide budget.
      const items = b.props.items.flatMap((it) => {
        const { photoId, ...rest } = it;
        const url = urlById.get(photoId);
        if (!url || usedPhotos.has(url)) return [];
        usedPhotos.add(url);
        return [{ ...rest, imageUrl: url }];
      });
      return { type: "switchback", props: { ...b.props, items }, section: b.section, variant: b.variant };
    }
    if (b.type === "marquee") {
      // Benefits strip, not a keyword strip (see cleanBenefitStrip): drop the
      // keyword-shaped items here, and let the item floor below drop the whole
      // section when too little honest content is left. The title fallback
      // keeps a surviving strip from rendering as an unlabelled band.
      const items = cleanBenefitStrip(b.props.items, facts.city);
      return {
        type: "marquee",
        props: { ...b.props, title: b.props.title?.trim() || BENEFITS_TITLE, items },
        section: b.section,
        variant: b.variant,
      };
    }
    return b;
  })
    // Contact-value hygiene (owner audit 2026-08-10, item 8). The rule is not
    // «fix the Instagram section» — it is that NO user-visible string on a
    // generated site is ever a URL. A model asked for a subtitle will paste the
    // profile link into it, and a fact that means a handle can arrive as a full
    // address; either way the page ends up printing machine output as copy, and
    // an unbreakable 451px token scrolls the whole phone viewport sideways.
    // Identity fields (handle/telegram/instagram) are canonicalized separately
    // in groundAndPlace; image/href props are never touched (invariant 1).
    .map(scrubVisibleUrls);

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
    // Belt for the types the prompt doesn't offer (UNREACHABLE_TYPES): always
    // richText; switchback too until the wireframe registers the story
    // section as variants-capable (V3 connect decision).
    .filter((b) => !UNREACHABLE_TYPES.has(b.type))
    // A connected story whose rows all lost their photo cast has nothing to
    // render — the zig-zag needs an image per row (§4.8).
    .filter((b) => b.type !== "switchback" || b.props.items.length >= 1)
    // gallery is kept when ≥2 real photos fill it — or when background
    // generation will (pendingImages shimmer placeholders). A fabricated or
    // single-photo gallery still reads as a bug on the live site (§4.8).
    .filter(
      (b) =>
        b.type !== "gallery" ||
        b.props.images.length >= 2 ||
        (b.props.pendingImages ?? 0) > 0,
    )
    // Item floors for the list/grid sections (blockLibrary.minItems +
    // belowMin): a stats row with one number, a two-step «process», a press
    // wall with a single mention or a benefits strip that cleaned down to
    // nothing all read as unfinished — drop them rather than ship a grid of
    // one. Only `belowMin: "drop"` types can fail here: gallery declares its
    // floor for the prompt but leaves enforcement to its own rule above (which
    // also honours the pendingImages shimmer), and the `keep` types
    // (services/team/testimonials) ship their single genuine item while the
    // LAYOUT adapts (applySingleItemLayouts + the wireframe's single-item
    // render guard).
    .filter((b) => meetsItemFloor(b.type, itemCountOf(b)))
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
        // C1 → v2 §5: a section may repeat ONCE (rich content, e.g. services:
        // main + additional) — but ONLY when its def carries the explicit
        // `repeatable` flag. The licence used to be «has alternate layouts»,
        // which would have turned every V3 variant section into a repeatable
        // one (two CTA bands). See sectionRepeatCap.
        return used <= sectionRepeatCap(template.sections[section]);
      }
      const seenCount = (perSection[b.type] ?? 0) + 1;
      perSection[b.type] = seenCount;
      return seenCount <= blockLibrary[b.type].maxPerPage;
    })
    .slice(0, COMPOSITION_RULES.maxMiddle);

  // COMPOSITION FLOOR — assert it where the DROPS happen, not only in the
  // prompt. `minMiddle` was raised 3 → 4 to stop thin pages, but it is prompt
  // text everywhere else: the filter chain above can remove a benefits strip, a
  // one-number stats row, a thin gallery and a map with no address, so a model
  // that shipped exactly four middles can land on two with no event and no log.
  // Nothing is invented to repair it (that is what the whole grounding contract
  // forbids) — but a thin page must at least be VISIBLE in the pipeline logs.
  if (middle.length < COMPOSITION_RULES.minMiddle) {
    console.warn(
      `[assemble] thin page: ${middle.length} middle block(s) after the deterministic drops, floor is ${COMPOSITION_RULES.minMiddle} (model proposed ${raw.filter((b) => blockLibrary[b.type].role === "middle").length}) — kept: ${middle.map((b) => b.type).join(", ") || "none"}`,
    );
  }

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
    galleryPool().length >= 2 && !modelChoseGallery && canHostGallery
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
  let placed = ordered.map((b) =>
    groundAndPlace(
      groundHrefs(groundImages(b, allowed), facts, factHrefs),
      facts,
      seen,
      template,
      igFollowers,
    ),
  );

  // The plan's variants fill the gaps the model left — BEFORE the repeat-
  // layout safety net below, so a plan-assigned layout participates in the
  // «no two identical adjacent layouts» check like any other.
  placed = applyPlanVariantDefaults(placed, plan, template);

  // Generic seeded variant fallback (spec §4, axis `variant:<sectionId>`):
  // a variant-capable section that BOTH the model and the plan left on the
  // default layout gets a seeded roll — the hero's «empty choice must not
  // always land on the default» rule, generalized. Hero is excluded: its
  // variant was already resolved at conversion (photo veto + its own legacy
  // `variant` stream). Runs BEFORE the repeat-layout reassignment so a rolled
  // layout participates in the no-identical-repeats check like any other.
  if (template && sectionVariantRoll) {
    // Per-INSTANCE roll streams: `rollAxis` is a pure function of its purpose
    // string, so keying on the section id alone would hand both instances of
    // a repeatable section the identical roll — the second instance would
    // always collide with the first and the safety net below would resolve
    // the collision instead of the axis. First instance keeps the bare id
    // (existing tenants' rolls stay byte-identical); the second rolls
    // `<sectionId>:2`.
    const occurrence: Record<string, number> = {};
    placed = placed.map((sb) => {
      if (!sb.section) return sb;
      const nth = (occurrence[sb.section] = (occurrence[sb.section] ?? 0) + 1);
      if (sb.section === "hero" || sb.variant !== undefined) return sb;
      // Photo-layout precondition: a photo-named layout (the V3 naming
      // contract, cf. servicesPhotoVariants) is only rollable when the block
      // actually carries per-item photos — the model was told to cast
      // photoIds ONLY when choosing a photo layout itself, so an unset
      // variant means an empty cast, and rolling cards-with-photo onto it
      // would render the plain grid.
      const hasItemPhotos =
        sb.type === "services" && sb.props.items.some((it) => Boolean(it.imageUrl));
      const rolled = sectionVariantForRoll(
        template.sections[sb.section],
        sectionVariantRoll(nth === 1 ? sb.section : `${sb.section}:${nth}`),
        (id) => /photo/i.test(id) && !hasItemPhotos,
      );
      return rolled ? { ...sb, variant: rolled } : sb;
    });
  }

  // C1/C4 safety net — see reassignRepeatedLayouts: a repeated section must
  // never repeat the SAME layout, with the option list canonicalized over the
  // hero pattern (a named default is the same component as `undefined`).
  if (template) {
    placed = reassignRepeatedLayouts(placed, template);
  }

  // Single-item layouts LAST in the variant chain (owner feedback 2026-08-10):
  // one genuine coach / one real review must not render as a card grid of one.
  // The data survives untouched — only the layout changes.
  placed = applySingleItemLayouts(placed, template);

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
  const grounded = placed.map((sb) =>
    mapHrefFields(sb, (href) =>
      href?.startsWith("#") && !validAnchors.has(href) ? leadAnchor : href,
    ),
  );

  // Last: the plan's budget hints (deterministic char clamps, §3-S3). After
  // every structural pass so the clamp sees exactly what will render — and
  // with the confirmed facts, so fact-bearing copy is never truncated.
  return applyCharBudgets(grounded, plan, facts);
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
/** The one canonical form of an identity contact fact, absence-preserving. */
function canonicalInstagram(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return normalizeIgHandle(raw) ?? raw;
}

function canonicalTelegram(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return normalizeTelegramUsername(raw) ?? raw;
}

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
      // No phone fact (optional since V2) → the link routes to the lead form.
      const digits = facts.phone ? normalizeUaPhoneDigits(facts.phone) : "";
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
        // Identity facts are grounded CANONICALLY (bare handle), never as the
        // raw string the owner pasted: a full "https://t.me/x" /
        // "https://instagram.com/x" in the props is what every renderer then
        // re-wraps into a broken link (live audit 2026-08-10). Unnormalizable
        // input falls through byte-identical — nothing is invented or lost.
        telegram: canonicalTelegram(facts.telegram) ?? b.props.telegram,
        // Strict (unlike the ?? fields above): a handle is only ever a FACT —
        // a model-invented one must not survive when the owner gave none.
        instagram: canonicalInstagram(facts.instagram),
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
        handle: canonicalInstagram(facts.instagram) ?? b.props.handle,
        followersCount: igFollowers,
      },
      ...placement,
      variant,
    };
  }

  return { ...b, ...placement, variant };
}
