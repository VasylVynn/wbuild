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
import { randomSkin } from "@/lib/blocks/skins";
import { themePresets, resolveTheme, THEME_PRESET_IDS } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme/tokens";
import { getVertical } from "@/lib/verticals/registry";
import type { VerticalConfig } from "@/lib/verticals/types";
import type { BusinessFacts } from "@/lib/verticals/schema";

/**
 * Phase 2 — AI composition (brief §4.1–4.4), vertical-aware. The model composes
 * a page from the block library via TOOL USE (structured-outputs strict mode
 * rejects the 10-variant union — "grammar too large"). It picks a theme from the
 * VERTICAL's allowed presets and gets the vertical's tone hint. Composition
 * rules, grounding, and nav placement are enforced in code afterwards.
 */

const generationSchema = z.object({
  themePresetId: z.enum(THEME_PRESET_IDS),
  blocks: z.array(blockInstanceSchema),
});
type Generation = z.infer<typeof generationSchema>;

export interface GeneratedSite {
  blocks: StoredBlock[];
  theme: Theme;
  themePresetId: string;
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

function buildSystem(vertical: VerticalConfig): string {
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

ТЕМА: обери themePresetId ЛИШЕ зі списку доступних, що найкраще пасує бренду.`;
}

const buildSiteTool = {
  name: "build_site",
  description: "Зібрати односторінковий сайт: обрати тему (themePresetId) і скомпонувати масив blocks.",
  input_schema: z.toJSONSchema(generationSchema),
} as unknown as Anthropic.Tool;

export async function generateSite(facts: BusinessFacts, verticalId?: string): Promise<GeneratedSite> {
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
      system: buildSystem(vertical),
      tools: [buildSiteTool],
      tool_choice: { type: "tool", name: "build_site" },
      messages,
    });

    const toolUse = res.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      lastError = `stop_reason=${res.stop_reason}, no tool_use block`;
      continue;
    }

    const parsed = generationSchema.safeParse(toolUse.input);
    if (parsed.success) {
      // Keep the model's theme only if it's allowed for this vertical.
      const themePresetId = vertical.themePresetIds.includes(parsed.data.themePresetId)
        ? parsed.data.themePresetId
        : vertical.themePresetIds[0];
      return {
        theme: resolveTheme(themePresetId),
        themePresetId,
        blocks: assemble(parsed.data.blocks, facts),
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
// Post-generation: enforce composition, ground facts, project nav placement.
// ---------------------------------------------------------------------------
function assemble(raw: BlockInstance[], facts: BusinessFacts): StoredBlock[] {
  const hero = raw.find((b) => b.type === "hero");
  const contacts = raw.find((b) => b.type === "contacts");

  const perType: Partial<Record<BlockType, number>> = {};
  const middle = raw
    .filter((b) => b.type !== "hero" && b.type !== "contacts" && b.type !== "lead_form")
    // Drop image-only blocks: no trusted photo source until upload (Phase 4);
    // the model would otherwise invent URLs (§4.8).
    .filter(hasUsableImages)
    .filter((b) => {
      const used = (perType[b.type] ?? 0) + 1;
      perType[b.type] = used;
      return used <= blockLibrary[b.type].maxPerPage;
    })
    .slice(0, COMPOSITION_RULES.maxMiddle);

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

  const ordered: BlockInstance[] = [
    ...(hero ? [hero] : []),
    ...middle,
    leadForm,
    ...(contacts ? [contacts] : []),
  ];

  const seen: Partial<Record<BlockType, number>> = {};
  return ordered.map((b) => groundAndPlace(b, facts, seen));
}

/** Image-only blocks are dropped until a trusted photo source exists (§4.8). */
function hasUsableImages(b: BlockInstance): boolean {
  return b.type !== "gallery" && b.type !== "switchback";
}

function computePlacement(type: BlockType, seen: Partial<Record<BlockType, number>>): BlockPlacement {
  const lib = blockLibrary[type];
  // Generation-time skin lottery (п.3): same content, varied layout — different
  // sites stop looking like one template. The editor can switch it any time.
  const skin = randomSkin(type);
  if (type === "contacts") {
    return { anchor: "#contacts", navLabel: lib.navLabel, showInNav: true, hidden: false, skin };
  }
  if (type === "lead_form") {
    return { anchor: "#lead", navLabel: lib.navLabel, showInNav: true, hidden: false, skin };
  }
  if (lib.role === "middle" && lib.inNav) {
    const n = (seen[type] = (seen[type] ?? 0) + 1);
    return {
      anchor: n === 1 ? `#${type}` : `#${type}-${n}`,
      navLabel: lib.navLabel,
      showInNav: true,
      hidden: false,
      skin,
    };
  }
  return { showInNav: false, hidden: false, skin };
}

function groundAndPlace(
  b: BlockInstance,
  facts: BusinessFacts,
  seen: Partial<Record<BlockType, number>>,
): StoredBlock {
  const placement = computePlacement(b.type, seen);

  if (b.type === "hero" && b.props.imageUrl) {
    return { ...b, props: { ...b.props, imageUrl: undefined }, ...placement };
  }

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
