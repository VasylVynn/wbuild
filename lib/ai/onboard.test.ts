import { describe, it, expect } from "vitest";
import { safeSlice, stripLoneSurrogates } from "@/lib/ai/sanitize";
import {
  sanitizeInboundMessage,
  hasContactChannel,
  applySaveFacts,
  buildFactsSummary,
  buildOnboardSystem,
  computeProgress,
  historyToMessages,
  sanitize,
  START_GENERATION_TOOL_NAME,
  onboardTools,
  type ChatMsg,
  type OnboardAccum,
} from "@/lib/ai/onboard";
import { getVertical, VERTICAL_IDS } from "@/lib/verticals/registry";
import { buildDossier } from "@/lib/dossier";

// ---------------------------------------------------------------------------
// C1 — message integrity (plan 2026-08-07 §8а C1).
// Live transcript showed «Логот� номера» (U+FFFD), «Адресаверджено!» (a long
// summary truncated at the 4000-char inbound cap glued with the next reply).
// Root cause: app/api/onboard parseBody safeSlice'd EVERY history message to
// MAX_MSG_CHARS — the model's view of its own long summary diverged from the
// persisted transcript, and the model then echoed the corrupted text back.
// Contract now: assistant history passes through byte-identical (only lone
// surrogates stripped); ONLY user text is length-capped.
// ---------------------------------------------------------------------------

/** >4000-char assistant summary with an emoji pair straddling the old cut. */
function longSummary(): string {
  return "а".repeat(3999) + "💇" + "\n\n**Адреса:** вул. Личаківська, 3\n\nПідтверджено!" + "б".repeat(300);
}

describe("C1: inbound history integrity", () => {
  it("assistant messages are NOT truncated (byte-identical round-trip)", () => {
    const original = longSummary();
    expect(original.length).toBeGreaterThan(4000);
    expect(sanitizeInboundMessage("assistant", original)).toBe(original);
  });

  it("user messages stay capped and never end in a lone surrogate", () => {
    const boundary = "х".repeat(3999) + "💇" + "hidden tail";
    const out = sanitizeInboundMessage("user", boundary);
    expect(out.length).toBeLessThanOrEqual(4000);
    // no split pair at the cut and no replacement chars
    expect(out).not.toMatch(/[\uD800-\uDBFF]$/);
    expect(out).not.toContain("�");
  });

  it("persist (saveTurn shape) → restore → model view keeps the summary intact", () => {
    const summary = longSummary();
    const messages: ChatMsg[] = [
      { role: "user", content: "Зробіть мені сайт 💅" },
      { role: "assistant", content: summary },
      { role: "user", content: "так, все вірно" },
    ];
    // saveTurn persists { role, content } verbatim; loadConversation returns as-is.
    const persisted = messages.map((m) => ({ role: m.role, content: m.content }));
    const restored = persisted as ChatMsg[];
    // byte-identical round-trip, no U+FFFD, no glued/lost messages
    expect(restored).toEqual(messages.map((m) => ({ role: m.role, content: m.content })));
    expect(restored).toHaveLength(3);
    for (const m of restored) expect(m.content).not.toContain("�");
    // the model view built from the restored transcript keeps the summary whole
    const modelView = historyToMessages(
      restored.map((m) => ({ role: m.role, content: sanitizeInboundMessage(m.role, m.content) })),
    );
    expect(modelView).toHaveLength(3);
    expect(modelView[1].content).toBe(summary);
  });

  it("multi-round text keeps its \\n\\n separator through sanitize()", () => {
    // The route joins round texts with "\n\n" (both into finalText and the SSE
    // deltas); sanitize() must not collapse it into glued words.
    const joined = "Знайшов адресу у профілі.\n\nПідтверджено!";
    expect(sanitize(joined)).toBe(joined);
  });
});

describe("safeSlice surrogate safety", () => {
  it("never splits a surrogate pair at the cut", () => {
    const s = "a".repeat(9) + "💇💇";
    const cut = safeSlice(s, 10); // index 9 is a high surrogate
    expect(cut).toBe("a".repeat(9));
    expect(stripLoneSurrogates(cut)).toBe(cut);
  });
  it("returns short strings unchanged", () => {
    expect(safeSlice("привіт 💇", 100)).toBe("привіт 💇");
  });
});

// ---------------------------------------------------------------------------
// C7 — readiness = businessName + ANY contact channel (not phone).
// ---------------------------------------------------------------------------

describe("C7: contact-channel readiness", () => {
  it("any of phone/telegram/instagram/viber counts as a contact", () => {
    expect(hasContactChannel({})).toBe(false);
    expect(hasContactChannel({ phone: "  " })).toBe(false);
    expect(hasContactChannel({ phone: "+380671234567" })).toBe(true);
    expect(hasContactChannel({ instagram: "lapusigroom" })).toBe(true);
    expect(hasContactChannel({ telegram: "@lapusi" })).toBe(true);
    expect(hasContactChannel({ viber: "0671234567" })).toBe(true);
  });

  it("progress chips count a phone-less IG contact as «Контакт»", () => {
    const items = computeProgress({ businessName: "Лапусі", instagram: "lapusigroom" });
    const contact = items.find((i) => i.key === "contact");
    expect(contact?.label).toBe("Контакт");
    expect(contact?.done).toBe(true);
    expect(items.find((i) => i.key === "phone")).toBeUndefined();
  });

  it("facts summary shows a contact row when only Instagram is known", () => {
    const s = buildFactsSummary({ businessName: "Лапусі", instagram: "lapusigroom" });
    expect(s).toContain("**Instagram:**");
    expect(s).not.toContain("**Телефон:**");
  });
});

// ---------------------------------------------------------------------------
// start_generation — readiness is a tool-call (plan §0.1, C2/C7).
// ---------------------------------------------------------------------------

describe("start_generation tool", () => {
  it("is part of the agentic tool set", () => {
    const names = (onboardTools as { name?: string }[]).map((t) => t.name);
    expect(names).toContain(START_GENERATION_TOOL_NAME);
  });
});

// ---------------------------------------------------------------------------
// Prompt contract (§0: generate-first, infer-don't-ask, honesty, one voice).
// ---------------------------------------------------------------------------

describe("buildOnboardSystem", () => {
  const base = {
    vertical: getVertical("generic"),
    facts: { businessName: "Лапусі" },
    dossier: null,
    issues: [],
    apifyEnabled: true,
  };

  it("teaches start_generation and bans claiming generation already runs", () => {
    const sys = buildOnboardSystem(base);
    expect(sys).toContain("start_generation");
    expect(sys).toContain("НІКОЛИ не стверджуй");
  });

  it("has no required-field checklist and no phone-only readiness", () => {
    const sys = buildOnboardSystem(base);
    expect(sys).not.toContain("без яких сайт не вийде");
    expect(sys).not.toContain('НЕМОЖЛИВІ без назви, міста і телефону');
  });

  it("advisor guidance never re-injects the questionnaire (infer, don't ask)", () => {
    // The W0 headline contract (≤1–2 clarifying questions per CONVERSATION)
    // must not be undermined by per-niche guidance ordering the model to
    // interrogate — the pre-W0 registry did exactly that.
    const banned = ["СПЕРШУ з'ясуй", "СПЕРШУ уточни", "спитай", "уточни "];
    for (const id of VERTICAL_IDS) {
      const sys = buildOnboardSystem({ ...base, vertical: getVertical(id) });
      for (const phrase of banned) expect(sys).not.toContain(phrase);
      // the gap block is data-driven, not a script — it must not smuggle the
      // interrogation phrasing back in either
      const withGaps = buildOnboardSystem({
        ...base,
        vertical: getVertical(id),
        gaps: [{ rule: "singleton_set", subject: "services", weight: 82, note: "Одна послуга." }],
      });
      for (const phrase of banned) expect(withGaps).not.toContain(phrase);
    }
  });

  it("carries the data-gap block only when the detector found something", () => {
    expect(buildOnboardSystem(base)).not.toContain("ПРОГАЛИНИ В ДАНИХ");
    const sys = buildOnboardSystem({
      ...base,
      gaps: [
        { rule: "singleton_set", subject: "testimonials", weight: 46, note: "Зібрано лише один відгук." },
      ],
    });
    expect(sys).toContain("ПРОГАЛИНИ В ДАНИХ");
    expect(sys).toContain("Зібрано лише один відгук.");
  });

  it("gap questions stay capped, skippable and non-blocking", () => {
    const sys = buildOnboardSystem({
      ...base,
      gaps: [{ rule: "empty_set", subject: "photos", weight: 80, note: "Жодного фото." }],
    });
    expect(sys).toContain("ЩОНАЙБІЛЬШЕ ОДНЕ коротке питання за хід");
    expect(sys).toContain("Пропустити");
    expect(sys).toContain("не блокуй створення сайту");
    // generate-first survives: readiness is still the tool call
    expect(sys).toContain("start_generation");
  });

  it("keeps the dossier LAST even with a gap block (prompt-cache ordering)", () => {
    const dossier = buildDossier({ facts: { businessName: "Лапусі" } });
    const sys = buildOnboardSystem({
      ...base,
      dossier,
      gaps: [{ rule: "empty_set", subject: "photos", weight: 80, note: "Жодного фото." }],
    });
    expect(sys.indexOf("ПРАВИЛО ПРО ДАНІ")).toBeGreaterThan(sys.indexOf("ПРОГАЛИНИ В ДАНИХ"));
  });

  it("keeps the dossier LAST (prompt-cache ordering)", () => {
    const dossier = buildDossier({ facts: { businessName: "Лапусі" } });
    const sys = buildOnboardSystem({ ...base, dossier });
    const marker = "ПРАВИЛО ПРО ДАНІ";
    expect(sys).toContain(marker);
    // nothing but the dossier follows the static prompt
    expect(sys.indexOf(marker)).toBeGreaterThan(sys.indexOf("Поточні зібрані факти"));
  });
});

// ---------------------------------------------------------------------------
// applySaveFacts fold (unchanged contract).
// ---------------------------------------------------------------------------

describe("applySaveFacts", () => {
  const base: OnboardAccum = { facts: {}, verticalId: "generic", status: "collecting", quickReplies: [] };

  it("folds a valid patch last-wins", () => {
    const next = applySaveFacts(
      { verticalId: "generic", factsPatch: { businessName: "Лапусі" }, status: "ready", quickReplies: [" Створюй "] },
      base,
    );
    expect(next.facts.businessName).toBe("Лапусі");
    expect(next.status).toBe("ready");
    expect(next.quickReplies).toEqual(["Створюй"]);
  });

  it("ignores invalid input", () => {
    expect(applySaveFacts({ nonsense: true }, base)).toEqual(base);
  });
});
