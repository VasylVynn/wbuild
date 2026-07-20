import "server-only";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, GEN_MODEL } from "./anthropic";
import {
  blockInstanceSchema,
  type BlockInstance,
  type BlockPlacement,
  type BlockType,
  type StoredBlock,
} from "@/lib/blocks/schema";
import { blockLibrary, COMPOSITION_RULES } from "@/lib/blocks/library";
import {
  getPack,
  packsFor,
  randomPack,
  DESIGN_PACK_IDS,
  type DesignPack,
} from "@/lib/design/packs";
import {
  getTemplate,
  siteTemplates,
  TEMPLATE_IDS,
  type SiteTemplate,
} from "@/lib/templates/registry";
import { themePresets, resolveTheme, THEME_PRESET_IDS } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme/tokens";
import { getVertical } from "@/lib/verticals/registry";
import type { VerticalConfig } from "@/lib/verticals/types";
import type { BusinessFacts } from "@/lib/verticals/schema";
import type { SiteMedia } from "@/lib/media/media";
import { isStorageUrl } from "@/lib/media/media";
import {
  normalizeUaPhoneDigits,
  instagramHref,
  telegramHref,
  viberHref,
} from "@/lib/blocks/contact-links";

/**
 * Phase 2 — AI composition (brief §4.1–4.4), vertical-aware. The model composes
 * a page from the block library via TOOL USE (structured-outputs strict mode
 * rejects the 10-variant union — "grammar too large"). It picks a theme from the
 * VERTICAL's allowed presets and gets the vertical's tone hint. Composition
 * rules, grounding, and nav placement are enforced in code afterwards.
 */

const generationSchema = z.object({
  themePresetId: z.enum(THEME_PRESET_IDS),
  // A whole-site TEMPLATE (preferred when the vertical has one): dictates the
  // entire look and the section menu the page is composed from. Falls back to
  // designPackId for verticals without templates.
  templateId: z
    .enum(TEMPLATE_IDS)
    .optional()
    .describe("Шаблон сайту зі списку доступних — задає весь вигляд і меню секцій, з яких компонується сторінка."),
  designPackId: z
    .enum(DESIGN_PACK_IDS)
    .optional()
    .describe("Дизайн-пакет зі списку доступних — задає цілісний вигляд сайту (тему й макет секцій)."),
  blocks: z.array(blockInstanceSchema),
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
  theme: Theme;
  themePresetId: string;
  // Design source: exactly one is set. Template sites carry `templateId` (packs
  // ignored); pack/legacy sites carry `packId`.
  packId?: string;
  templateId?: string;
  imageSubject?: string;
  // Model-written page meta (D1) — persisted with the page content (draft →
  // published), consumed by generateMetadata/OG/JSON-LD on the public render.
  seo?: { title?: string; description?: string };
}

function buildLibraryDoc(): string {
  return (Object.keys(blockLibrary) as BlockType[])
    // autoInjected blocks (lead_form) are added by code, never offered to the model.
    .filter((t) => !blockLibrary[t].autoInjected)
    .map((t) => {
      const e = blockLibrary[t];
      return `- ${t} (${e.label}; роль: ${e.role}; макс ${e.maxPerPage}× на сторінку): ${e.description}`;
    })
    .join("\n");
}

function buildThemeDoc(vertical: VerticalConfig): string {
  return vertical.themePresetIds
    .map((id) => `- ${id}: ${themePresets[id].label} — ${themePresets[id].mood}`)
    .join("\n");
}

/**
 * Full template menu for the model: every available template with its section
 * list (id — label — description — «контент за схемою блоку X»). All templates'
 * menus are listed because the model picks the template AND its sections in ONE
 * call. Sections are shown in the template's canonical `order`.
 */
function buildTemplateDoc(templates: SiteTemplate[]): string {
  return templates
    .map((t) => {
      const ids = [...t.order, ...Object.keys(t.sections).filter((id) => !t.order.includes(id))];
      const menu = ids
        .map((id) => {
          const def = t.sections[id];
          if (!def) return null;
          const vs = def.variants
            ? ` [layout: default | ${Object.keys(def.variants).join(" | ")}]`
            : "";
          return `    · ${id} — ${def.label}: ${def.description} (блок ${def.block})${vs}`;
        })
        .filter(Boolean)
        .join("\n");
      return `- ${t.id} — ${t.label}: ${t.description}\n  Секції (компонуй ЛИШЕ з них):\n${menu}`;
    })
    .join("\n\n");
}

function buildSystem(vertical: VerticalConfig, forced?: SiteTemplate): string {
  // When a template is forced (regenerate keeps the site's template), offer the
  // model ONLY that template's section menu — otherwise it may compose from a
  // different template's sections that assemble() would then drop/remap.
  const templates = forced ? [forced] : Object.values(siteTemplates);
  const templateRule = forced
    ? `ШАБЛОН уже зафіксовано (обраний для цього сайту раніше — в розмові або при створенні): ${forced.id} — ${forced.label}. Встанови templateId="${forced.id}" і компонуй сторінку ЛИШЕ із секцій цього шаблону. Правила:
- Для КОЖНОГО блоку вкажи section = id секції шаблону; тип блоку має відповідати вказаному («блок X»).
- Якщо секція має layout-варіанти [layout: default | …] — обери variant, що найкраще пасує цьому бізнесу; якщо не впевнений, не вказуй (буде default).
- hero-секція — перша, contacts-секція — остання; порядок — орієнтир, не догма.
- Кожну секцію зазвичай один раз. Якщо контенту СПРАВДІ багато — секцію можна використати ДВІЧІ (напр. послуги: основні + додаткові), але лише секцію з layout-варіантами, і повтори МУСЯТЬ мати РІЗНІ variant і РІЗНІ заголовки — сусідні однакові макети виглядають як помилка верстки. РІЗНІ секції можуть живитись ОДНИМ типом блоку (ліміт «макс ×» діє на секцію, не на тип).
Секції цього шаблону та layout-варіанти:
${buildTemplateDoc(templates)}

`
    : `ШАБЛОН (обов'язково): обери ОДИН templateId, чий ХАРАКТЕР і настрій найкраще передають суть цього бізнесу — за відчуттям, НЕ за нішею (жоден шаблон не «закріплений» за галуззю). Шаблон диктує ВЕСЬ вигляд (палітру, шрифти, анімації, може бути темним) і меню секцій. Правила:
- Компонуй сторінку ЛИШЕ із секцій обраного шаблону.
- Для КОЖНОГО блоку вкажи section = id секції шаблону; тип блоку має відповідати вказаному («блок X»).
- Якщо секція має layout-варіанти [layout: default | …] — обери variant, що найкраще пасує цьому бізнесу; якщо не впевнений, не вказуй (буде default).
- hero-секція — перша, contacts-секція — остання; порядок — орієнтир, не догма.
- Кожну секцію зазвичай один раз. Якщо контенту СПРАВДІ багато — секцію можна використати ДВІЧІ (напр. послуги: основні + додаткові), але лише секцію з layout-варіантами, і повтори МУСЯТЬ мати РІЗНІ variant і РІЗНІ заголовки — сусідні однакові макети виглядають як помилка верстки. РІЗНІ секції можуть живитись ОДНИМ типом блоку (ліміт «макс ×» діє на секцію, не на тип).
Доступні шаблони, їхні секції та layout-варіанти:
${buildTemplateDoc(templates)}

`;
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
- Факти — назва, телефон, адреса, години, ціни й назви послуг, відгуки — копіюй ТОЧНО з наданих даних. НЕ вигадуй і не змінюй їх.
- Маркетинговий текст (заголовки, слогани, описи, заклики) — пиши сам, тепло, живою українською, доречно для ніші.
- НІКОЛИ не вигадуй числа у stats — лише якщо є у фактах.
- Не вигадуй посилань на зображення.
- ЦІНИ: якщо у послуг НЕМАЄ цін у фактах — не залишай порожніх прайс-колонок і не пиши плейсхолдери («грн», «від …», «—»): подай послуги описово, без цінової сітки. Ціни, які Є у фактах, копіюй 1:1.

${templateRule}SEO-МЕТА (обов'язково заповни seo):
- seo.title — за формулою «{головна послуга} у {місто} — {назва}», до 60 символів. Головну послугу бери з фактів, місто — з фактів.
- seo.description — 1–2 продаючі речення до 150 символів: що робить бізнес, для кого, у якому місті. Природною мовою, без лапок і переліку через кому всіх послуг.

SEO В ТЕКСТАХ СТОРІНКИ:
- Частину заголовків секцій пиши з ключовими словами ніші, за якими шукають у Google («Весільні букети», «Ремонт ходової»), а НЕ лише образними («Наша магія»). Образність — у підзаголовки й описи.
- Місто згадай природно у 1–2 місцях сторінки (напр. hero-підзаголовок або «про нас») — НЕ в кожному заголовку і НЕ списком міст. Переспам ключовими словами читається як спам і шкодить довірі.

ТЕМА: обери themePresetId ЛИШЕ зі списку доступних, що найкраще пасує бренду (використовується для favicon/прев'ю — вигляд самої сторінки повністю задає обраний шаблон).

HERO-ЗОБРАЖЕННЯ: заповни imageSubject — короткий опис АНГЛІЙСЬКОЮ (до 15 слів) атмосферного ФОНОВОГО зображення, що асоціюється саме з цим бізнесом: текстури, матеріали, гра світла, природа. ЗАБОРОНЕНО: приміщення/фасади/вітрини, впізнавані товари як «наші», люди, будь-який текст. Приклад для хімчистки: "soft folded fresh linen textures in airy light".`;
}

const buildSiteTool = {
  name: "build_site",
  description: "Зібрати односторінковий сайт: обрати тему (themePresetId) і скомпонувати масив blocks.",
  input_schema: z.toJSONSchema(generationSchema),
} as unknown as Anthropic.Tool;

export async function generateSite(
  facts: BusinessFacts,
  verticalId?: string,
  // Owner-uploaded media (§4.8). The MODEL never learns about photos — this only
  // drives the deterministic post-pass in assemble(). Optional so callers that
  // don't thread media keep working (no photos → no hero/gallery imagery).
  media?: SiteMedia,
  // Force a specific design pack (e.g. regenerate keeps the site's existing
  // design). When set, it overrides the model's pick and the random fallback.
  packId?: string,
  // Force a specific template (regenerate keeps the site's existing template;
  // onboarding forwards the design the chat agent picked, wave B4).
  // When it resolves, the template path wins and packs are ignored entirely.
  templateId?: string,
): Promise<GeneratedSite> {
  const client = getAnthropic();
  const vertical = getVertical(verticalId);
  // Resolve a forced template once (regenerate keeps the site's template) — it
  // both constrains the model's section menu and wins the final resolution.
  const forcedTemplate = templateId ? getTemplate(templateId) : undefined;

  const userPrompt = `Бібліотека блоків:
${buildLibraryDoc()}

Доступні теми (обери лише з цих):
${buildThemeDoc(vertical)}

Факти бізнесу (JSON):
${JSON.stringify(facts, null, 2)}

Збери сайт за правилами вище і виклич build_site.`;

  let lastError = "no tool call";
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: Anthropic.MessageParam[] =
      attempt === 0
        ? [{ role: "user", content: userPrompt }]
        : [
            { role: "user", content: userPrompt },
            {
              role: "user",
              content: `Попередній результат не пройшов валідацію схеми: ${lastError}. Виправ і виклич build_site ще раз.`,
            },
          ];

    const res = await client.messages.create({
      model: GEN_MODEL,
      max_tokens: 16000,
      // Extended thinking: the owner already watches a ~30s progress screen, so
      // the latency is free — the composition/copy quality is not. Thinking is
      // incompatible with a forced tool_choice → "auto"; a missing tool call is
      // handled as a failed attempt by this retry loop.
      thinking: { type: "enabled", budget_tokens: 6000 },
      system: buildSystem(vertical, forcedTemplate),
      tools: [buildSiteTool],
      tool_choice: { type: "auto" },
      messages,
    });

    const toolUse = res.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      lastError = `stop_reason=${res.stop_reason}, no tool_use block`;
      continue;
    }

    const parsed = generationSchema.safeParse(toolUse.input);
    if (parsed.success) {
      // TEMPLATE path (owner mandate): the caller's template (regenerate keeps
      // it) → the model's pick if this vertical has that template. When resolved,
      // the template dictates the whole look and packs are IGNORED. The persisted
      // theme is still the model's preset (favicon/OG metadata) — the wrapper
      // overrides the actual on-page colors.
      // Template is the primary design path: the model picks any template BY
      // CHARACTER (no vertical gate), regenerate keeps the caller's, and a fixed
      // default is the last-resort safety net — never a random pick.
      const template =
        forcedTemplate ??
        getTemplate(parsed.data.templateId) ??
        getTemplate("studio") ??
        Object.values(siteTemplates)[0];
      if (template) {
        return {
          theme: resolveTheme(parsed.data.themePresetId),
          themePresetId: parsed.data.themePresetId,
          templateId: template.id,
          blocks: assemble(parsed.data.blocks, facts, undefined, media, template),
          imageSubject: parsed.data.imageSubject,
          seo: clampSeo(parsed.data.seo),
        };
      }

      // The design pack decides the LOOK (theme + a fixed skin per block) so the
      // site reads as ONE cohesive design, not a per-block skin lottery. Priority:
      // caller's pack (regenerate keeps the design) → model's choice if compatible
      // with this vertical → a random compatible pack. The pack ALWAYS wins over
      // the model's themePresetId.
      const compatible = packsFor(vertical.id);
      const pack =
        (packId ? getPack(packId) : undefined) ??
        compatible.find((p) => p.id === parsed.data.designPackId) ??
        randomPack(vertical.id);
      return {
        theme: resolveTheme(pack.themePresetId),
        themePresetId: pack.themePresetId,
        packId: pack.id,
        blocks: assemble(parsed.data.blocks, facts, pack, media, undefined),
        imageSubject: parsed.data.imageSubject,
        seo: clampSeo(parsed.data.seo),
      };
    }
    lastError = parsed.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
  }

  throw new Error(`Generation failed schema validation after retries: ${lastError}`);
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
 */
function resolvedSection(template: SiteTemplate | undefined, b: BlockInstance): string | undefined {
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
// Post-generation: enforce composition, ground facts, project nav placement.
// ---------------------------------------------------------------------------
function assemble(
  raw: BlockInstance[],
  facts: BusinessFacts,
  pack: DesignPack | undefined,
  media: SiteMedia | undefined,
  template: SiteTemplate | undefined,
): StoredBlock[] {
  const photos = media?.photos ?? [];
  // The generated hero (§4.8) is a trusted, bucket-hosted URL like a real photo:
  // it may back the hero, so it belongs in the allow-set. Gallery stays photos-only.
  const generatedHero = media?.generatedHero;
  const allowed = new Set(photos);
  if (generatedHero) allowed.add(generatedHero);
  const businessName = facts.businessName;
  // D3: deterministic alt base for owner photos — name + city (local-SEO
  // keywords that are always TRUE). The model never sees images (§4.8), so
  // descriptive alts are never model-written; the vision layer's per-photo
  // description (wave G, photoMeta.alt) wins over the base when it exists.
  const altBase = facts.city ? `${businessName}, ${facts.city}` : businessName;
  const altByUrl = new Map<string, string>();
  for (const m of media?.photoMeta ?? []) {
    if (m.alt?.trim()) altByUrl.set(m.url, m.alt.trim());
  }
  const photoAlt = (url: string, fallback: string) => altByUrl.get(url) ?? fallback;

  const hero = raw.find((b) => b.type === "hero");
  const contacts = raw.find((b) => b.type === "contacts");

  // The hero consumes photos[0] as its background (see groundImages). A gallery
  // repeating that same photo reads as a bug on the live site, so the gallery
  // pool is photos 2..N whenever the hero took one; if fewer than 2 remain, no
  // gallery at all.
  const heroPhoto = hero ? photos[0] : undefined;
  const galleryPhotos = heroPhoto ? photos.slice(1) : photos;

  const perType: Partial<Record<BlockType, number>> = {};
  const perSection: Record<string, number> = {};
  const middle = raw
    .filter((b) => b.type !== "hero" && b.type !== "contacts" && b.type !== "lead_form")
    // switchback has no trusted per-item image source → always dropped (§4.8).
    .filter((b) => b.type !== "switchback")
    // gallery is kept ONLY when ≥2 real photos remain to fill it (after the
    // hero took its one); its own images are model-invented and replaced below.
    // Otherwise the model would show fabricated imagery (§4.8 honesty invariant).
    .filter((b) => b.type !== "gallery" || galleryPhotos.length >= 2)
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
      const used = (perType[b.type] ?? 0) + 1;
      perType[b.type] = used;
      return used <= blockLibrary[b.type].maxPerPage;
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

  // With ≥2 real photos and no model gallery, inject one from the uploads right
  // before the lead funnel — routed through the same placement path as any block.
  // Skip on a template with no gallery section: it would render via the default
  // (light) registry component inside the template's shell and break the look.
  const canHostGallery = !template || sectionForType(template, "gallery") !== undefined;
  const injectedGallery: BlockInstance[] =
    galleryPhotos.length >= 2 && !modelChoseGallery && canHostGallery
      ? [
          {
            type: "gallery",
            props: {
              title: "Наші фото",
              images: galleryPhotos.map((url, i) => ({
                url,
                alt: photoAlt(url, `${altBase} — фото ${i + 1}`),
              })),
            },
          },
        ]
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

  const seen: Partial<Record<BlockType, number>> = {};
  const factHrefs = allowedFactHrefs(facts);
  const placed = ordered.map((b) =>
    groundAndPlace(
      groundHrefs(
        groundImages(b, photos, galleryPhotos, allowed, altBase, photoAlt, generatedHero),
        facts,
        factHrefs,
      ),
      facts,
      seen,
      pack,
      template,
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
 * Deterministic image grounding (§4.8): the model never sees photo URLs, so
 * every image field is (re)assigned from the uploaded set here. Nothing invented
 * ever survives — a fabricated URL is stripped, a real photo is placed.
 */
function groundImages(
  b: BlockInstance,
  photos: string[],
  galleryPhotos: string[],
  allowed: Set<string>,
  altBase: string,
  photoAlt: (url: string, fallback: string) => string,
  generatedHero?: string,
): BlockInstance {
  switch (b.type) {
    case "hero": {
      // Hero background := first real photo → generated atmospheric hero → none
      // (never a model-invented URL). Real uploads always win over the generated one.
      // Alt is deterministic too (D3): the model never saw the image, so any
      // alt it wrote is overwritten — a real photo gets the vision layer's
      // description when one exists (wave G), else the name+city base; the
      // generated atmospheric image says exactly what it is.
      const imageUrl = photos[0] ?? generatedHero;
      const imageAlt = photos[0]
        ? photoAlt(photos[0], altBase)
        : imageUrl
          ? `Атмосферне зображення — ${altBase}`
          : undefined;
      return { ...b, props: { ...b.props, imageUrl, imageAlt } };
    }
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
    case "gallery":
      // Any surviving gallery (kept or injected) is filled with the real photos,
      // minus the one already backing the hero (no visible duplicate).
      return {
        ...b,
        props: {
          ...b.props,
          images: galleryPhotos.map((url, i) => ({
            url,
            alt: photoAlt(url, `${altBase} — фото ${i + 1}`),
          })),
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
  pack: DesignPack | undefined,
  template: SiteTemplate | undefined,
  section: string | undefined,
): BlockPlacement {
  const lib = blockLibrary[type];
  // Template sites carry a `section` and NO skin — the template owns the whole
  // look. Pack sites carry a fixed skin per block type and no section: a cohesive,
  // template-faithful look, NOT a per-block lottery. "" (or absent) skin means the
  // component's default variant. The editor can still switch it any time.
  const skin = template ? undefined : pack?.skins[type] || undefined;
  if (type === "contacts") {
    return { anchor: "#contacts", navLabel: lib.navLabel, showInNav: true, hidden: false, skin, section };
  }
  if (type === "lead_form") {
    return { anchor: "#lead", navLabel: lib.navLabel, showInNav: true, hidden: false, skin, section };
  }
  if (lib.role === "middle" && lib.inNav) {
    const n = (seen[type] = (seen[type] ?? 0) + 1);
    return {
      anchor: n === 1 ? `#${type}` : `#${type}-${n}`,
      navLabel: lib.navLabel,
      showInNav: true,
      hidden: false,
      skin,
      section,
    };
  }
  return { showInNav: false, hidden: false, skin, section };
}

function groundAndPlace(
  b: BlockInstance,
  facts: BusinessFacts,
  seen: Partial<Record<BlockType, number>>,
  pack: DesignPack | undefined,
  template: SiteTemplate | undefined,
): StoredBlock {
  const section = resolvedSection(template, b);
  const variant = resolvedVariant(template, section, b.variant);
  const placement = computePlacement(b.type, seen, pack, template, section);

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

  return { ...b, ...placement, variant };
}
