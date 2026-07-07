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
import { THEME_PRESET_IDS, themePresets, resolveTheme } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme/tokens";
import type { FloristFacts } from "@/lib/verticals/florist";

/**
 * Phase 2 — AI composition (brief §4.1–4.4, extended per owner decision to
 * compose from a block library instead of a fixed preset). The model returns a
 * structured object via TOOL USE (the brief's base mechanism, §4.3): a theme
 * choice + an ordered array of blocks picked from the registry. We validate the
 * tool arguments against blockInstanceSchema (Zod) and retry on mismatch — so
 * structure is composed, never hallucinated. Structured-outputs constrained
 * decoding is avoided here because a 10-variant union compiles to too large a
 * grammar. Composition rules, grounding, and nav placement are enforced in code
 * AFTER generation, not trusted to the model.
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
    .map((t) => {
      const e = blockLibrary[t];
      return `- ${t} (${e.label}; роль: ${e.role}; макс ${e.maxPerPage}× на сторінку): ${e.description}`;
    })
    .join("\n");
}

function buildThemeDoc(): string {
  return THEME_PRESET_IDS.map((id) => `- ${id}: ${themePresets[id].label} — ${themePresets[id].mood}`).join(
    "\n",
  );
}

const SYSTEM = `Ти — досвідчений веб-дизайнер і копірайтер, що збирає односторінковий сайт українському локальному бізнесу (квіткарня).
Ти НЕ пишеш HTML. Ти КОМПОНУЄШ сторінку з фіксованої бібліотеки блоків: обираєш, які блоки і в якому порядку використати, і заповнюєш їхній вміст. Виклич інструмент build_site з результатом.

ПРАВИЛА КОМПОЗИЦІЇ (обов'язкові):
- Перший блок — завжди hero. Останній — завжди contacts.
- Між ними — від ${COMPOSITION_RULES.minMiddle} до ${COMPOSITION_RULES.maxMiddle} блоків із бібліотеки; набір і порядок обираєш сам під конкретний бізнес.
- Не використовуй жоден тип блоку частіше за його ліміт "макс ×".
- Різні бізнеси мають отримувати РІЗНІ набори й порядок блоків — не роби однаковий шаблон.

GROUNDING (критично для довіри клієнта):
- Факти — назва, телефон, адреса, години роботи, ціни й назви послуг, тексти відгуків та їхні автори — копіюй ТОЧНО з наданих даних. НЕ вигадуй і не змінюй їх.
- Маркетинговий текст (заголовки, слогани, описи секцій, заклики до дії) — пиши сам, тепло, живою українською.
- НІКОЛИ не вигадуй числа (роки досвіду, кількість клієнтів) у блоці stats: додавай його лише якщо конкретне число реально є у фактах, інакше пропусти.
- Для зображень використовуй ЛИШЕ надані URL; не вигадуй посилань на фото.

ТЕМА: обери themePresetId, що найкраще пасує настрою бренду.`;

// Tool input schema, derived from the Zod schema (non-strict tool use — the
// model uses it as guidance; we validate the arguments ourselves afterwards).
const buildSiteTool = {
  name: "build_site",
  description: "Зібрати односторінковий сайт: обрати тему (themePresetId) і скомпонувати масив blocks.",
  input_schema: z.toJSONSchema(generationSchema),
} as unknown as Anthropic.Tool;

export async function generateSite(facts: FloristFacts): Promise<GeneratedSite> {
  const client = getAnthropic();

  const userPrompt = `Бібліотека блоків:
${buildLibraryDoc()}

Доступні теми:
${buildThemeDoc()}

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
      system: SYSTEM,
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
      return {
        theme: resolveTheme(parsed.data.themePresetId),
        themePresetId: parsed.data.themePresetId,
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
function assemble(raw: BlockInstance[], facts: FloristFacts): StoredBlock[] {
  const hero = raw.find((b) => b.type === "hero");
  const contacts = raw.find((b) => b.type === "contacts");

  // Middle = everything else, capped by per-type maxPerPage and by maxMiddle.
  const perType: Partial<Record<BlockType, number>> = {};
  const middle = raw
    .filter((b) => b.type !== "hero" && b.type !== "contacts")
    // Drop image-only blocks that ended up with no real images (facts had none;
    // the model correctly refused to invent URLs — §4.8 — leaving them empty).
    // Real photos arrive with upload (Phase 4); until then, no blank sections.
    .filter(hasUsableImages)
    .filter((b) => {
      const used = (perType[b.type] ?? 0) + 1;
      perType[b.type] = used;
      return used <= blockLibrary[b.type].maxPerPage;
    })
    .slice(0, COMPOSITION_RULES.maxMiddle);

  const ordered: BlockInstance[] = [
    ...(hero ? [hero] : []),
    ...middle,
    ...(contacts ? [contacts] : []),
  ];

  const seen: Partial<Record<BlockType, number>> = {};
  return ordered.map((b) => groundAndPlace(b, facts, seen));
}

/**
 * Whether an image-only block may be kept. There is NO trusted image source
 * until photo upload (Phase 4): the model would otherwise invent stock URLs,
 * which §4.8 forbids (never fabricate imagery — broken/generic images kill
 * trust). So drop gallery/switchback for now; composition still varies via the
 * text blocks. These section types re-activate once real photos exist.
 */
function hasUsableImages(b: BlockInstance): boolean {
  return b.type !== "gallery" && b.type !== "switchback";
}

function computePlacement(type: BlockType, seen: Partial<Record<BlockType, number>>): BlockPlacement {
  const lib = blockLibrary[type];
  if (type === "contacts") {
    return { anchor: "#contacts", navLabel: lib.navLabel, showInNav: true, hidden: false };
  }
  if (lib.role === "middle" && lib.inNav) {
    const n = (seen[type] = (seen[type] ?? 0) + 1);
    return {
      anchor: n === 1 ? `#${type}` : `#${type}-${n}`,
      navLabel: lib.navLabel,
      showInNav: true,
      hidden: false,
    };
  }
  return { showInNav: false, hidden: false };
}

function groundAndPlace(
  b: BlockInstance,
  facts: FloristFacts,
  seen: Partial<Record<BlockType, number>>,
): StoredBlock {
  const placement = computePlacement(b.type, seen);

  // Strip any hero background image the model invented (no trusted source yet).
  if (b.type === "hero" && b.props.imageUrl) {
    return { ...b, props: { ...b.props, imageUrl: undefined }, ...placement };
  }

  // Grounding (§4.4): the contact facts are known — force them verbatim so a
  // reworded/hallucinated phone or address can never reach the published site.
  if (b.type === "contacts") {
    return {
      ...b,
      props: {
        ...b.props,
        phone: facts.phone ?? b.props.phone,
        address: facts.address ?? b.props.address,
        hours: facts.hours ?? b.props.hours,
      },
      ...placement,
    };
  }

  return { ...b, ...placement };
}
