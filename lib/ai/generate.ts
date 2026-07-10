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
  templatesFor,
  TEMPLATE_IDS,
  type SiteTemplate,
} from "@/lib/templates/registry";
import { themePresets, resolveTheme, THEME_PRESET_IDS } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme/tokens";
import { getVertical } from "@/lib/verticals/registry";
import type { VerticalConfig } from "@/lib/verticals/types";
import type { BusinessFacts } from "@/lib/verticals/schema";
import type { SiteMedia } from "@/lib/media/media";

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
});

export interface GeneratedSite {
  blocks: StoredBlock[];
  theme: Theme;
  themePresetId: string;
  // Design source: exactly one is set. Template sites carry `templateId` (packs
  // ignored); pack/legacy sites carry `packId`.
  packId?: string;
  templateId?: string;
  imageSubject?: string;
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

function buildPackDoc(vertical: VerticalConfig): string {
  return packsFor(vertical.id)
    .map((p) => `- ${p.id} — ${p.label}: ${p.description}`)
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
          return `    · ${id} — ${def.label}: ${def.description} (контент за схемою блоку ${def.block})`;
        })
        .filter(Boolean)
        .join("\n");
      return `- ${t.id} — ${t.label}: ${t.description}\n  Секції (компонуй ЛИШЕ з них):\n${menu}`;
    })
    .join("\n\n");
}

function buildSystem(vertical: VerticalConfig): string {
  const templates = templatesFor(vertical.id);
  const templateRule =
    templates.length > 0
      ? `ШАБЛОН (пріоритет над дизайн-пакетом): обери ОДИН templateId — цілісний шаблон, що найкраще пасує цьому бізнесу. Шаблон диктує ВЕСЬ вигляд (палітру, шрифти, анімації, може бути темним) і меню секцій, з яких збирається сторінка. Правила:
- Компонуй сторінку ЛИШЕ із секцій обраного шаблону.
- Для КОЖНОГО блоку вкажи поле section = id секції шаблону; тип блоку має відповідати вказаному в секції («контент за схемою блоку X»).
- hero-секція — перша, contacts-секція — остання; порядок з переліку секцій — орієнтир, не догма.
- Кожну СЕКЦІЮ використовуй щонайбільше один раз. РІЗНІ секції можуть живитись ОДНИМ типом блоку (напр. features, howitworks і pricing — три РІЗНІ секції зі схемою services) — у шаблоні ліміт «макс ×» діє на секцію, не на тип блоку.
- НЕ обирай designPackId, якщо обрав templateId.
Доступні шаблони та їхні секції:
${buildTemplateDoc(templates)}

`
      : "";
  return `Ти — досвідчений веб-дизайнер і копірайтер, що збирає односторінковий сайт українському бізнесу: ${vertical.label} (${vertical.personaHint}).
Тон і акценти: ${vertical.genHint}.
Ти НЕ пишеш HTML. Ти КОМПОНУЄШ сторінку з фіксованої бібліотеки блоків: обираєш, які блоки і в якому порядку, і заповнюєш їхній вміст. Виклич інструмент build_site.

ПРАВИЛА КОМПОЗИЦІЇ (обов'язкові):
- Перший блок — завжди hero. Останній — завжди contacts.
- Між ними — від ${COMPOSITION_RULES.minMiddle} до ${COMPOSITION_RULES.maxMiddle} блоків із бібліотеки; набір і порядок обираєш під конкретний бізнес.
- Не використовуй жоден тип блоку частіше за його ліміт "макс ×".
- Різні бізнеси мають отримувати РІЗНІ набори й порядок блоків — не роби однаковий шаблон.

GROUNDING (критично для довіри):
- Факти — назва, телефон, адреса, години, ціни й назви послуг, відгуки — копіюй ТОЧНО з наданих даних. НЕ вигадуй і не змінюй їх.
- Маркетинговий текст (заголовки, слогани, описи, заклики) — пиши сам, тепло, живою українською, доречно для ніші.
- НІКОЛИ не вигадуй числа у stats — лише якщо є у фактах.
- Не вигадуй посилань на зображення.

${templateRule}ДИЗАЙН: обери designPackId — цілісний дизайн-пакет, що найкраще пасує настрою цього бізнесу. Пакет задає палітру, шрифти й макет УСІХ секцій, тож сайт виглядає як єдине ціле, а не набір випадкових стилів. Доступні пакети:
${buildPackDoc(vertical)}

ТЕМА (запасний варіант): якщо не впевнений із пакетом — обери themePresetId ЛИШЕ зі списку доступних, що найкраще пасує бренду. Пакет має пріоритет над темою.

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
  // Force a specific template (regenerate keeps the site's existing template).
  // When it resolves, the template path wins and packs are ignored entirely.
  templateId?: string,
): Promise<GeneratedSite> {
  const client = getAnthropic();
  const vertical = getVertical(verticalId);

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
      system: buildSystem(vertical),
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
      const affinity = templatesFor(vertical.id);
      const template =
        (templateId ? getTemplate(templateId) : undefined) ??
        affinity.find((t) => t.id === parsed.data.templateId);
      if (template) {
        return {
          theme: resolveTheme(parsed.data.themePresetId),
          themePresetId: parsed.data.themePresetId,
          templateId: template.id,
          blocks: assemble(parsed.data.blocks, facts, undefined, media, template),
          imageSubject: parsed.data.imageSubject,
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

  const hero = raw.find((b) => b.type === "hero");
  const contacts = raw.find((b) => b.type === "contacts");

  const perType: Partial<Record<BlockType, number>> = {};
  const perSection: Record<string, number> = {};
  const middle = raw
    .filter((b) => b.type !== "hero" && b.type !== "contacts" && b.type !== "lead_form")
    // switchback has no trusted per-item image source → always dropped (§4.8).
    .filter((b) => b.type !== "switchback")
    // gallery is kept ONLY when ≥2 real photos exist to fill it; its own images
    // are model-invented and replaced below. Otherwise the model would show
    // fabricated imagery (§4.8 honesty invariant).
    .filter((b) => b.type !== "gallery" || photos.length >= 2)
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
        return used <= 1;
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
    photos.length >= 2 && !modelChoseGallery && canHostGallery
      ? [
          {
            type: "gallery",
            props: { title: "Наші фото", images: photos.map((url) => ({ url, alt: businessName })) },
          },
        ]
      : [];

  const ordered: BlockInstance[] = [
    ...(hero ? [hero] : []),
    ...middle,
    ...injectedGallery,
    leadForm,
    ...(contacts ? [contacts] : []),
  ];

  const seen: Partial<Record<BlockType, number>> = {};
  return ordered.map((b) =>
    groundAndPlace(
      groundImages(b, photos, allowed, businessName, generatedHero),
      facts,
      seen,
      pack,
      template,
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
  allowed: Set<string>,
  businessName: string,
  generatedHero?: string,
): BlockInstance {
  switch (b.type) {
    case "hero":
      // Hero background := first real photo → generated atmospheric hero → none
      // (never a model-invented URL). Real uploads always win over the generated one.
      return { ...b, props: { ...b.props, imageUrl: photos[0] ?? generatedHero } };
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
      // Any surviving gallery (kept or injected) is filled with the real photos.
      return { ...b, props: { ...b.props, images: photos.map((url) => ({ url, alt: businessName })) } };
    default:
      return b;
  }
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
      },
      ...placement,
    };
  }

  return { ...b, ...placement };
}
