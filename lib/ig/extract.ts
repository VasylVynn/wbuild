import "server-only";
import { getAnthropic, isAnthropicConfigured, GEN_MODEL } from "@/lib/ai/anthropic";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";
import type { IgProfile } from "./apify";

/**
 * Facts extraction from an Instagram profile (wave E): one LLM pass over the
 * bio + post captions → candidate facts for the onboarding conversation.
 *
 * HONESTY RULES (invariant №5 — no invented facts):
 * - Only what is LITERALLY written in the bio/captions may be extracted; the
 *   model must never guess or embellish. Prices only when explicit.
 * - Phones/requisites are deliberately NOT extracted — the agent asks for them
 *   explicitly in chat (they must be owner-typed, not scraped).
 * - Everything returned here is a CANDIDATE: the client shows it in the
 *   aggregated summary and the owner confirms/corrects before generation
 *   (the A6 summary gate still applies on top).
 *
 * FAIL-OPEN: missing key, timeout, API error, unparseable output → null; the
 * import then carries photos only and the conversation collects facts as usual.
 */

const EXTRACT_TIMEOUT_MS = 30_000;
const MAX_CAPTION_CHARS = 500; // per caption, keeps the call bounded
const MAX_CAPTIONS = 15;

/** Candidate facts an IG profile can honestly yield. */
export type IgExtractedFacts = Partial<
  Pick<BusinessFacts, "businessName" | "city" | "about" | "services">
>;

const extractTool = {
  name: "extracted_facts",
  description: "Структуровані факти про бізнес, витягнуті ДОСЛІВНО з Instagram-профілю.",
  input_schema: {
    type: "object" as const,
    properties: {
      businessName: {
        type: "string",
        description:
          "Назва бізнесу, якщо вона явно видна з імені профілю чи біо. Не вигадуй і не «покращуй» назву.",
      },
      city: {
        type: "string",
        description:
          "Місто, ЛИШЕ якщо воно прямо написане в біо або підписах (напр. «Львів», «Київ, Позняки» → «Київ»). Не вгадуй за мовою чи контекстом.",
      },
      about: {
        type: "string",
        description:
          "Короткий опис бізнесу НА ОСНОВІ біо і підписів: перекажи вірно, без нових тверджень, без хештегів і емодзі, українською (переклади вірно, якщо оригінал іншою мовою). ≤300 символів. Не додавай фактів, яких нема в тексті.",
      },
      services: {
        type: "array",
        description:
          "Послуги/товари, які ЯВНО згадані в біо чи підписах. Ціну вказуй лише коли вона написана прямо (число з валютою чи «від N грн») — копіюй її формулювання. Без цін, яких нема в тексті.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Назва послуги/товару, як у тексті (українською)." },
            price: { type: "string", description: "Ціна ДОСЛІВНО з тексту (напр. «від 500 грн»). Пропусти, якщо ціни нема." },
          },
          required: ["name"],
        },
      },
    },
    required: [],
  },
};

/**
 * Bio + captions → candidate facts. `null` = extraction unavailable; the
 * caller proceeds with photos only.
 */
export async function extractFactsFromProfile(
  profile: IgProfile,
): Promise<IgExtractedFacts | null> {
  if (!isAnthropicConfigured()) return null;

  const captions = profile.posts
    .map((p) => p.caption?.trim())
    .filter((c): c is string => Boolean(c))
    .slice(0, MAX_CAPTIONS)
    .map((c) => (c.length > MAX_CAPTION_CHARS ? `${c.slice(0, MAX_CAPTION_CHARS)}…` : c));

  const source = [
    `Імʼя профілю: ${profile.fullName ?? profile.handle}`,
    profile.bio ? `Біо:\n${profile.bio}` : "Біо: (порожнє)",
    captions.length
      ? `Підписи останніх постів:\n${captions.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
      : "Підписів немає.",
  ].join("\n\n");

  try {
    const client = getAnthropic();
    const res = await client.messages.create(
      {
        model: GEN_MODEL,
        max_tokens: 1500,
        system:
          "Ти витягуєш факти про малий бізнес з його Instagram-профілю для створення сайту. " +
          "ЗАЛІЗНЕ ПРАВИЛО: бери ЛИШЕ те, що написано в тексті дослівно — жодних здогадок, узагальнень чи «типових» послуг. " +
          "Краще пропустити поле, ніж вигадати. Телефони, адреси й графік НЕ витягуй — їх спитають у власника окремо. " +
          "Виклич extracted_facts рівно один раз.",
        messages: [{ role: "user", content: source }],
        tools: [extractTool],
        tool_choice: { type: "tool", name: "extracted_facts" },
      },
      { timeout: EXTRACT_TIMEOUT_MS },
    );

    const tool = res.content.find((c) => c.type === "tool_use");
    if (!tool || tool.type !== "tool_use") return null;

    // Validate through the business facts schema so a malformed field can
    // never poison the conversation's facts state.
    const parsed = businessFactsSchema
      .pick({ businessName: true, city: true, about: true, services: true })
      .partial()
      .safeParse(tool.input);
    if (!parsed.success) return null;

    const clean = (s: string | undefined, max: number) => {
      const t = s?.trim();
      return t ? t.slice(0, max) : undefined;
    };
    const services = (parsed.data.services ?? [])
      .map((s) => ({
        name: clean(s.name, 120) ?? "",
        ...(clean(s.price, 60) && { price: clean(s.price, 60) }),
      }))
      .filter((s) => s.name)
      .slice(0, 12);

    const out: IgExtractedFacts = {
      ...(clean(parsed.data.businessName, 120) && { businessName: clean(parsed.data.businessName, 120) }),
      ...(clean(parsed.data.city, 60) && { city: clean(parsed.data.city, 60) }),
      ...(clean(parsed.data.about, 400) && { about: clean(parsed.data.about, 400) }),
      ...(services.length && { services }),
    };
    return Object.keys(out).length ? out : null;
  } catch (e) {
    console.warn(`[ig-extract] failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
