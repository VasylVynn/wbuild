# Style QA Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A data-level QA gate on the generated stylesheet: deterministic CSS lint + WCAG contrast auto-fix + one bounded model verdict for gross aesthetics, wired into the existing draft quality loop and the editor redesign action.

**Architecture:** Three new pure modules under `lib/design` (css-lint, css-contrast, style-audit orchestrator) feed an extended `runDraftQualityLoop` (`lib/site/inspect.ts`). Fixes are structured only: code strips/rewrites CSS declarations; a failing verdict triggers ONE `generateWireStyle` re-call with a corrective note. Report persists as a draft-only `styleAudit` field in `PageContent`; the admin sites table shows a QA column. No browser, no screenshots, no new tables.

**Tech Stack:** Next.js 15 App Router, TypeScript, postcss (new dep), culori (new dep, WCAG contrast + OKLCH), Anthropic SDK (existing patterns from `lib/site/inspect.ts`).

**Spec:** `docs/superpowers/specs/2026-07-28-style-qa-gate-design.md` — read it first.

## Global Constraints

- All user-facing copy (prompts, admin labels) is Ukrainian; code/comments/commits English.
- Fail-open EVERYWHERE: an audit error logs (`console.warn` with a `[style-audit]` prefix) and never blocks generation. Mirrors `runDraftQualityLoop`'s contract.
- Every `draft_content` write spreads the read `PageContent` and overrides only changed keys (`lib/site/page-content.ts` header is the law). Style writes are CAS-gated on `draft_content->>genToken` when the draft carries one.
- The model NEVER writes raw CSS in the fix path (invariant §7). Only code transforms + `generateWireStyle` re-calls.
- Regen budget: at most ONE `generateWireStyle` re-call per gate run.
- No test runner (user decision). Per-task verification = `npx tsc --noEmit` + curl smokes against the dev route + `npm run build` at the end.
- `node`/`npm`/`npx` are NOT on PATH in this environment — prefix commands:
  `export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"`.
- Dev server for smokes: `npm run dev` (port 3000, hosts `lvh.me:3000` / `app.lvh.me:3000`).
- `components/templates/salonwire/**` has uncommitted changes from a PARALLEL session — read `wire.css`/`sections.tsx` freely but do NOT edit or commit anything under `components/templates/**`, `.env.example`, or `lib/supabase/auth.ts`.
- Commit only files this plan creates/modifies, one logical unit per task, conventional messages.

---

### Task 1: Dependencies + `styleAudit` content field

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `lib/site/page-content.ts`

**Interfaces:**
- Produces: `StyleAuditReport` type and `PageContent.styleAudit?: StyleAuditReport`, consumed by Tasks 4–7.

- [ ] **Step 1: Install dependencies**

```bash
export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"
npm install postcss culori
npm install -D @types/culori
```

Note: `@tailwindcss/postcss` exists as a devDependency but `postcss` itself must be a direct runtime dependency — the audit imports it in server code.

- [ ] **Step 2: Add the report type and draft-only field**

In `lib/site/page-content.ts`, add above `PageContent`:

```ts
/** Result of the style QA gate (css-lint + contrast + model verdict). Draft-only:
 *  diagnostics for the editor/admin, never published. */
export interface StyleAuditReport {
  /** Human-readable notes for every stripped declaration/at-rule. */
  lintViolations: string[];
  /** Human-readable notes for every contrast auto-fix. */
  contrastFixes: string[];
  verdict: "pass" | "fail";
  /** Ukrainian corrective note from the model verdict (present on fail). */
  correctiveNote?: string;
  /** True when the gate spent its one stylesheet regeneration. */
  regenerated: boolean;
  /** Final fail after the regen budget — surfaces in the admin QA column. */
  flagged: boolean;
  checkedAt: string;
}
```

Inside `PageContent`, after `generatedHero?: string;` add:

```ts
  /** Style QA gate report — editor/admin diagnostics only (see StyleAuditReport). */
  styleAudit?: StyleAuditReport;
```

Change `DRAFT_ONLY` to:

```ts
const DRAFT_ONLY = ["pocket", "styleAudit"] as const satisfies readonly (keyof PageContent)[];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → expected: clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/site/page-content.ts
git commit -m "feat(qa-gate): styleAudit draft-only field + postcss/culori deps"
```

---

### Task 2: Deterministic CSS lint (`lib/design/css-lint.ts` + dev harness)

**Files:**
- Create: `lib/design/css-lint.ts`
- Create: `app/api/dev/style-audit/route.ts` (local-only smoke harness, extended in Tasks 3–4)

**Interfaces:**
- Produces: `lintWireCss(css: string): LintResult` with `interface LintResult { cleanCss: string; violations: string[] }`. Consumed by Tasks 4–6.

- [ ] **Step 1: Write `lib/design/css-lint.ts`**

```ts
import "server-only";
import postcss, { type AtRule, type Declaration, type Rule } from "postcss";

/**
 * Deterministic lint of the model-generated stylesheet against the wire-style
 * prompt contract (lib/design/wire-style.ts SYSTEM). The prompt forbids
 * layout-breaking CSS but nothing verified the model obeyed — this strips the
 * offenders so a bad sheet degrades to "less styled", never "broken mobile".
 *
 * Heuristics (spec 2026-07-28, v1 — deliberately conservative):
 * - every @media is stripped wholesale: wire.css owns responsiveness, a
 *   generated breakpoint is suspect by definition (invariant §7);
 * - @import and @font-face are stripped; font-family declarations too;
 * - rules whose EVERY selector targets ::before/::after are the decor layer —
 *   display/position/float are legitimate there and stay;
 * - on ordinary selectors display/position/float are stripped, and
 *   width/height/min-width/min-height unless the value is fluid
 *   (auto/percentage/fit-content/...); max-width stays (allowed on text);
 * - overflow is stripped only on `.wire-section` selectors (sections must never
 *   clip content); card-level overflow (border-radius clipping) is benign;
 * - url() to any http(s) origin is stripped (§4.8: no foreign URLs; the sheet
 *   never needs remote assets — data: URIs and gradients stay);
 * - selectors not scoped under .tpl-salonwire are re-scoped (prefixed), so a
 *   leaked selector can't restyle platform chrome.
 */
export interface LintResult {
  cleanCss: string;
  violations: string[];
}

const STRIP_ALWAYS = new Set(["font-family"]);
const STRIP_ON_REAL_ELEMENTS = new Set(["display", "position", "float"]);
const SIZE_PROPS = new Set(["width", "height", "min-width", "min-height"]);
const FLUID_VALUE = /^(auto|inherit|initial|unset|fit-content|max-content|min-content|100%|\d{1,3}%)$/i;

function isDecorRule(rule: Rule): boolean {
  return rule.selectors.every((s) => s.includes("::before") || s.includes("::after"));
}

export function lintWireCss(css: string): LintResult {
  const violations: string[] = [];
  let root;
  try {
    root = postcss.parse(css);
  } catch (e) {
    // Unparseable sheet: fail-open — ship it untouched, note why.
    return {
      cleanCss: css,
      violations: [`unparseable css (left as-is): ${e instanceof Error ? e.message : e}`],
    };
  }

  root.walkAtRules((at: AtRule) => {
    if (at.name === "media" || at.name === "import" || at.name === "font-face") {
      violations.push(`stripped @${at.name}${at.params ? ` ${at.params.slice(0, 60)}` : ""}`);
      at.remove();
    }
  });

  root.walkRules((rule: Rule) => {
    const decor = isDecorRule(rule);
    rule.walkDecls((decl: Declaration) => {
      const prop = decl.prop.toLowerCase();
      const where = `${rule.selector.slice(0, 80)}`;
      if (STRIP_ALWAYS.has(prop)) {
        violations.push(`stripped \`${prop}\` from \`${where}\``);
        decl.remove();
        return;
      }
      if (!decor && STRIP_ON_REAL_ELEMENTS.has(prop)) {
        violations.push(`stripped \`${prop}: ${decl.value.slice(0, 40)}\` from \`${where}\``);
        decl.remove();
        return;
      }
      if (!decor && SIZE_PROPS.has(prop) && !FLUID_VALUE.test(decl.value.trim())) {
        violations.push(`stripped fixed \`${prop}: ${decl.value.slice(0, 40)}\` from \`${where}\``);
        decl.remove();
        return;
      }
      if (prop.startsWith("overflow") && rule.selector.includes(".wire-section")) {
        violations.push(`stripped \`${prop}\` from section \`${where}\``);
        decl.remove();
        return;
      }
      if (/url\(\s*['"]?https?:/i.test(decl.value)) {
        violations.push(`stripped external url() in \`${prop}\` from \`${where}\``);
        decl.remove();
        return;
      }
    });
    if (rule.nodes?.length === 0) rule.remove();
  });

  // Re-scope leaked selectors under the wireframe root class.
  root.walkRules((rule: Rule) => {
    if (rule.parent?.type === "atrule") return; // keyframes steps etc.
    rule.selectors = rule.selectors.map((s) => {
      const t = s.trim();
      if (t.startsWith(".tpl-salonwire") || t.startsWith(":root") || t.startsWith("@")) return s;
      violations.push(`re-scoped leaked selector \`${t.slice(0, 60)}\``);
      return `.tpl-salonwire ${t}`;
    });
  });

  return { cleanCss: root.toString(), violations };
}
```

- [ ] **Step 2: Write the dev harness route**

Create `app/api/dev/style-audit/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { lintWireCss } from "@/lib/design/css-lint";

/** Local-only smoke harness for the style QA gate modules (no test runner in
 *  this repo — /api/dev/* is the established substitute). Extended per-task. */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as { css?: string } | null;
  if (!body?.css) return NextResponse.json({ error: "css required" }, { status: 400 });
  const lint = lintWireCss(body.css);
  return NextResponse.json({ lint });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → expected: clean.

- [ ] **Step 4: Smoke the lint**

With `npm run dev` running:

```bash
curl -s http://lvh.me:3000/api/dev/style-audit -H 'content-type: application/json' -d '{
  "css": ".tpl-salonwire .wire-hero { display: grid; position: fixed; width: 900px; color: #333; } .tpl-salonwire .wire-hero::before { display: block; position: absolute; content: \"\"; } .wire-card { font-family: Arial; background: url(https://evil.example/x.png); max-width: 60ch; } @media (max-width: 900px) { .tpl-salonwire .wire-section { display: none; } }"
}' | python3 -m json.tool
```

Expected in `lint.violations`: stripped `display`, `position`, fixed `width` from `.wire-hero`; stripped `font-family` and external url() from `.wire-card`; re-scoped `.wire-card`; stripped `@media`. Expected KEPT in `cleanCss`: `color: #333`, the whole `::before` decor rule (display/position intact), `max-width: 60ch`.

- [ ] **Step 5: Commit**

```bash
git add lib/design/css-lint.ts app/api/dev/style-audit/route.ts
git commit -m "feat(qa-gate): deterministic css lint of the generated stylesheet"
```

---

### Task 3: Contrast audit + auto-fix (`lib/design/css-contrast.ts`)

**Files:**
- Create: `lib/design/css-contrast.ts`
- Modify: `app/api/dev/style-audit/route.ts` (add contrast to the harness)

**Interfaces:**
- Consumes: nothing from other tasks (postcss/culori only).
- Produces: `fixContrast(css: string): ContrastResult` with `interface ContrastResult { css: string; fixes: string[] }`. Consumed by Tasks 4–6.

- [ ] **Step 1: Write `lib/design/css-contrast.ts`**

```ts
import "server-only";
import postcss, { type Rule } from "postcss";
import { parse as parseColor, formatHex, wcagContrast, converter } from "culori";

/**
 * Static WCAG contrast check over the generated sheet. A browser would resolve
 * the cascade for us; without one we exploit the fact that the wireframe is
 * SINGULAR and ours: a hand-kept map of structural text↔surface pairs (below)
 * approximates "which text sits on which background". Below 4.5:1 the TEXT
 * color's OKLCH lightness is pushed away from the background until the ratio
 * passes — a single-declaration rewrite, never a palette change (spec §2).
 *
 * Known limits (accepted, v1): pairs the map doesn't list aren't checked;
 * background-image patterns skip the pair (unknowable statically); gradients
 * are checked against their WORST color stop.
 */
export interface ContrastResult {
  css: string;
  fixes: string[];
}

/** Structural pairs from components/templates/salonwire/sections.tsx. sameElement
 *  pairs read color+background off one selector (buttons). */
const PAIRS: { text: string; surface: string; sameElement?: boolean }[] = [
  { text: ".wire-title", surface: ".wire-hero" },
  { text: ".wire-subtitle", surface: ".wire-hero" },
  { text: ".wire-eyebrow", surface: ".wire-hero" },
  { text: ".wire-title", surface: ".wire-section" },
  { text: ".wire-text", surface: ".wire-section" },
  { text: ".wire-heading", surface: ".wire-card" },
  { text: ".wire-text", surface: ".wire-card" },
  { text: ".wire-price", surface: ".wire-card" },
  { text: ".wire-btn--primary", surface: ".wire-btn--primary", sameElement: true },
  { text: ".wire-footer", surface: ".wire-footer", sameElement: true },
];

const MIN_RATIO = 4.5;
const toOklch = converter("oklch");

/** Every parseable color token in a value (covers gradients stop-by-stop). */
function colorTokens(value: string): string[] {
  const tokens = value.match(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb|color)\([^)]*\)|\b[a-z]{3,20}\b/gi) ?? [];
  return tokens.filter((t) => parseColor(t) !== undefined);
}

interface Hit { rule: Rule; declIndex: number; value: string }

/** Last declaration of `props` in rules mentioning `cls` — later wins, and a
 *  rule that ALSO mentions `context` (section-scoped override) wins over one
 *  that doesn't. Crude cascade, right for .tpl-salonwire-scoped sheets. */
function findLast(root: postcss.Root, cls: string, props: string[], context?: string): Hit | undefined {
  let hit: Hit | undefined;
  let hitHasContext = false;
  root.walkRules((rule) => {
    if (!rule.selector.includes(cls)) return;
    if (rule.selector.includes("::before") || rule.selector.includes("::after")) return;
    const hasContext = Boolean(context && context !== cls && rule.selector.includes(context));
    rule.nodes?.forEach((node, i) => {
      if (node.type !== "decl" || !props.includes(node.prop.toLowerCase())) return;
      if (hitHasContext && !hasContext) return; // scoped hit already found
      hit = { rule, declIndex: i, value: node.value };
      hitHasContext = hasContext;
    });
  });
  return hit;
}

export function fixContrast(css: string): ContrastResult {
  const fixes: string[] = [];
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return { css, fixes }; // lint already reported unparseable — fail-open
  }

  for (const pair of PAIRS) {
    const textHit = findLast(root, pair.text, ["color"], pair.sameElement ? undefined : pair.surface);
    const bgHit = findLast(root, pair.surface, ["background-color", "background"]);
    if (!textHit || !bgHit) continue;
    if (/url\(/i.test(bgHit.value)) continue; // pattern background — unknowable

    const textColor = parseColor(colorTokens(textHit.value)[0] ?? "");
    const bgTokens = colorTokens(bgHit.value);
    if (!textColor || bgTokens.length === 0) continue;

    // Worst stop governs (gradient-safe; single color = one token).
    let worst = bgTokens[0];
    let worstRatio = Infinity;
    for (const t of bgTokens) {
      const r = wcagContrast(textColor, t);
      if (r < worstRatio) { worstRatio = r; worst = t; }
    }
    if (worstRatio >= MIN_RATIO) continue;

    const bg = parseColor(worst)!;
    const bgL = toOklch(bg)?.l ?? 0.5;
    const adjusted = { ...toOklch(textColor)! };
    // Push text lightness AWAY from the background until readable (≤20 steps).
    for (let i = 0; i < 20 && wcagContrast(adjusted, bg) < MIN_RATIO; i++) {
      adjusted.l = Math.min(1, Math.max(0, adjusted.l + (bgL > 0.5 ? -0.05 : 0.05)));
    }
    if (wcagContrast(adjusted, bg) < MIN_RATIO) {
      // Bound hit (extreme chroma) — snap to black/white, always passes on a
      // mid-or-extreme background at 20 steps of travel.
      adjusted.l = bgL > 0.5 ? 0 : 1;
      adjusted.c = 0;
    }
    const newHex = formatHex(adjusted);
    const decl = textHit.rule.nodes?.[textHit.declIndex];
    if (decl?.type !== "decl") continue;
    fixes.push(
      `contrast ${pair.text} on ${pair.surface}: ${worstRatio.toFixed(1)}:1 → ` +
        `${wcagContrast(adjusted, bg).toFixed(1)}:1 (color ${decl.value.slice(0, 30)} → ${newHex})`,
    );
    decl.value = newHex;
  }

  return { css: root.toString(), fixes };
}
```

- [ ] **Step 2: Extend the dev harness**

In `app/api/dev/style-audit/route.ts`, add the import and run contrast after lint:

```ts
import { fixContrast } from "@/lib/design/css-contrast";
```

```ts
  const lint = lintWireCss(body.css);
  const contrast = fixContrast(lint.cleanCss);
  return NextResponse.json({ lint, contrast });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → expected: clean. (`@types/culori@4` exports `wcagContrast`, `converter`, `parse`, `formatHex` at top level — verified against the actual .d.ts during plan review; no augmentation needed.)

- [ ] **Step 4: Smoke the contrast fix**

```bash
curl -s http://lvh.me:3000/api/dev/style-audit -H 'content-type: application/json' -d '{
  "css": ".tpl-salonwire .wire-hero { background: #2a2a35; } .tpl-salonwire .wire-hero .wire-title { color: #3a3a45; } .tpl-salonwire .wire-card { background-color: #ffffff; } .tpl-salonwire .wire-card .wire-text { color: #111111; }"
}' | python3 -m json.tool
```

Expected: one fix for `.wire-title` on `.wire-hero` (≈1.1:1 → ≥4.5:1, new color light); NO fix for `.wire-text` on `.wire-card` (already 18:1). The returned `contrast.css` carries the rewritten `color`.

- [ ] **Step 5: Commit**

```bash
git add lib/design/css-contrast.ts app/api/dev/style-audit/route.ts
git commit -m "feat(qa-gate): static WCAG contrast audit with OKLCH auto-fix"
```

---

### Task 4: Model verdict + orchestrator (`lib/design/style-audit.ts`)

**Files:**
- Create: `lib/design/style-audit.ts`
- Modify: `lib/site/inspect.ts` (export a digest helper — 3 lines)
- Modify: `app/api/dev/style-audit/route.ts` (full-audit mode)

**Interfaces:**
- Consumes: `lintWireCss` (Task 2), `fixContrast` (Task 3), `StyleAuditReport` (Task 1), `generateWireStyle(brief, {hue})` (`lib/design/wire-style.ts:81`, existing), `getAnthropic`/`GEN_MODEL` (`lib/ai/anthropic`, existing).
- Produces:
  - `buildSectionDigest(blocks: StoredBlock[]): string` exported from `lib/site/inspect.ts`;
  - `runStyleAudit(opts: { css: string | undefined; sectionDigest: string; brief: string; hue: number }): Promise<{ css: string | undefined; report: StyleAuditReport }>` — consumed by Tasks 5–6.

- [ ] **Step 1: Export the digest helper from `lib/site/inspect.ts`**

`sectionEntries`/`sectionDigest` are module-private. Add below `sectionDigest` (keep both private):

```ts
/** Visible-text digest for consumers outside the loop (style audit). */
export function buildSectionDigest(blocks: StoredBlock[]): string {
  return sectionDigest(sectionEntries(blocks));
}
```

- [ ] **Step 2: Write `lib/design/style-audit.ts`**

```ts
import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, GEN_MODEL } from "@/lib/ai/anthropic";
import { stripLoneSurrogates } from "@/lib/ai/sanitize";
import { lintWireCss } from "@/lib/design/css-lint";
import { fixContrast } from "@/lib/design/css-contrast";
import { generateWireStyle } from "@/lib/design/wire-style";
import type { StyleAuditReport } from "@/lib/site/page-content";

/**
 * The style QA gate (spec 2026-07-28): deterministic lint + contrast first,
 * then ONE bounded model verdict on gross aesthetics. A failing verdict spends
 * the single regen budget — generateWireStyle re-run with the corrective note
 * appended to the brief, same hue — and the regenerated sheet is re-linted and
 * re-judged. Still failing → the sheet with fewer deterministic violations
 * ships (tie → the original) and the report is flagged for the admin QA column.
 * Fail-open throughout: any error keeps the current css and never throws.
 */

const verdictSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  note: z
    .string()
    .describe("Якщо fail — одне коротке конкретне зауваження українською, ЩО саме зламано")
    .optional(),
});

const verdictTool = {
  name: "report_style_verdict",
  description: "Повернути вердикт про якість стилю.",
  input_schema: z.toJSONSchema(verdictSchema),
} as unknown as Anthropic.Tool;

async function auditStyleWithModel(
  css: string,
  sectionDigest: string,
): Promise<{ verdict: "pass" | "fail"; note?: string }> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: GEN_MODEL,
    max_tokens: 500,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system: `Ти — арт-директор, який приймає згенерований дизайн сайту малого українського бізнесу. Тобі дано стильовий CSS сайту і текст його секцій. Оціни ЛИШЕ грубі дефекти, НЕ смакові нюанси:
- кислотні або конфліктні кольори, які б'ють по очах;
- нечитабельні комбінації (текст майже зливається з фоном);
- хаос: кілька несумісних дизайн-ідей упереміш, відсутність будь-якої ієрархії;
- стиль, що явно суперечить типу бізнесу (похмурий морок для дитячої студії).
Нормальний, хай і не геніальний, дизайн = pass. Сумніваєшся — pass.
Виклич report_style_verdict; на fail додай note — одне конкретне зауваження українською (його передадуть дизайнеру як правку).`,
    tools: [verdictTool],
    tool_choice: { type: "tool", name: "report_style_verdict" },
    messages: [
      {
        role: "user",
        content: stripLoneSurrogates(`СЕКЦІЇ САЙТУ (видимий текст):
${sectionDigest}

СТИЛЬОВИЙ CSS:
\`\`\`css
${css.slice(0, 80000)}
\`\`\`

Виклич report_style_verdict.`),
      },
    ],
  });
  const toolUse = res.content.find((b) => b.type === "tool_use");
  const parsed = toolUse?.type === "tool_use" ? verdictSchema.safeParse(toolUse.input) : undefined;
  if (!parsed?.success) return { verdict: "pass" }; // unparseable → fail-open
  return { verdict: parsed.data.verdict, note: parsed.data.note };
}

export async function runStyleAudit(opts: {
  css: string | undefined;
  sectionDigest: string;
  brief: string;
  hue: number;
}): Promise<{ css: string | undefined; report: StyleAuditReport }> {
  const report: StyleAuditReport = {
    lintViolations: [],
    contrastFixes: [],
    verdict: "pass",
    regenerated: false,
    flagged: false,
    checkedAt: new Date().toISOString(),
  };
  if (!opts.css) return { css: opts.css, report }; // grey wireframe — nothing to audit

  // Phase 1: deterministic, always.
  const lint = lintWireCss(opts.css);
  const contrast = fixContrast(lint.cleanCss);
  report.lintViolations = lint.violations;
  report.contrastFixes = contrast.fixes;
  let css = contrast.css;

  // Phase 2: one bounded verdict; fail → one regen, re-lint, re-judge.
  try {
    const first = await auditStyleWithModel(css, opts.sectionDigest);
    report.verdict = first.verdict;
    report.correctiveNote = first.note;
    if (first.verdict === "fail") {
      report.regenerated = true;
      const correctedBrief = `${opts.brief}\nПопередня версія стилю мала ваду — обов'язково уникни її: ${first.note ?? "нечитабельний, конфліктний стиль"}.`;
      const regen = await generateWireStyle(correctedBrief, { hue: opts.hue });
      const relint = lintWireCss(regen.css);
      const recontrast = fixContrast(relint.cleanCss);
      const second = await auditStyleWithModel(recontrast.css, opts.sectionDigest);
      const regenDetIssues = relint.violations.length;
      const origDetIssues = report.lintViolations.length;
      if (second.verdict === "pass" || regenDetIssues < origDetIssues) {
        css = recontrast.css;
        report.lintViolations = relint.violations;
        report.contrastFixes = recontrast.fixes;
        report.verdict = second.verdict;
        report.correctiveNote = second.note;
      }
    }
  } catch (e) {
    console.warn(`[style-audit] model phase failed (fail-open): ${e instanceof Error ? e.message : e}`);
  }
  // Unconditional (plan-review must-fix): a crash mid-regen aborts the block
  // above — a failing verdict must still surface in the admin QA column.
  report.flagged = report.verdict === "fail";

  return { css, report };
}
```

- [ ] **Step 3: Extend the dev harness to full-audit mode**

Replace the body of `app/api/dev/style-audit/route.ts`'s POST with:

```ts
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as
    | { css?: string; full?: boolean; digest?: string; brief?: string; hue?: number }
    | null;
  if (!body?.css) return NextResponse.json({ error: "css required" }, { status: 400 });
  if (body.full) {
    const result = await runStyleAudit({
      css: body.css,
      sectionDigest: body.digest ?? "- [id=hero, блок hero] Тестовий заголовок",
      brief: body.brief ?? "Тестовий бізнес, Київ.",
      hue: body.hue ?? 180,
    });
    return NextResponse.json(result);
  }
  const lint = lintWireCss(body.css);
  const contrast = fixContrast(lint.cleanCss);
  return NextResponse.json({ lint, contrast });
```

with the import `import { runStyleAudit } from "@/lib/design/style-audit";`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` → expected: clean.

- [ ] **Step 5: Real-call smoke (repo rule: AI-flow change = one real API call)**

With `ANTHROPIC_API_KEY` in `.env.local` and dev running:

```bash
curl -s http://lvh.me:3000/api/dev/style-audit -H 'content-type: application/json' -d '{
  "full": true,
  "css": ".tpl-salonwire .wire-hero { background: linear-gradient(#ff0000, #00ff00); } .tpl-salonwire .wire-hero .wire-title { color: #ffff00; } .tpl-salonwire .wire-card { background: #ff00ff; } .tpl-salonwire .wire-card .wire-text { color: #00ffff; }"
}' | python3 -m json.tool
```

Expected: `report.verdict` very likely `"fail"` on this acid sheet, `report.regenerated: true`, a Ukrainian `correctiveNote`, and (because regen calls the real stylesheet generator) a materially different `css`. Run once more with a sane muted sheet → `verdict: "pass"`, `regenerated: false`. Budget note: the acid smoke spends ~1 stylesheet generation (~16k max_tokens) — run it once, not in a loop.

- [ ] **Step 6: Commit**

```bash
git add lib/design/style-audit.ts lib/site/inspect.ts app/api/dev/style-audit/route.ts
git commit -m "feat(qa-gate): model style verdict + bounded regen orchestrator"
```

---

### Task 5: Wire the gate into generation (`runDraftQualityLoop` + `publish.ts`)

**Files:**
- Modify: `lib/site/inspect.ts` (`runDraftQualityLoop`, declared at :403)
- Modify: `lib/site/publish.ts` (brief/hue pass-through; call site :202)

**Interfaces:**
- Consumes: `runStyleAudit`, `buildSectionDigest` (Task 4), `StyleAuditReport` (Task 1).
- Produces: `runDraftQualityLoop` opts gain `styleBrief?: string; styleHue?: number` — consumed by callers (only `publish.ts` passes them; `app/api/dev/generate` and admin generate flow through `generateDraft` and need no change).

- [ ] **Step 1: Pass brief and hue out of `generateDraft`**

In `lib/site/publish.ts`, the brief and hue are computed inside a block scope (:106-128). Lift them so the loop call can reuse them: replace the block

```ts
    let wireCss: string | undefined = prevWireCss;
    {
      const brief = [
```

with

```ts
    let wireCss: string | undefined = prevWireCss;
    const brief = [
```

(un-indent the block body accordingly, delete the closing `}` of that bare block, and move `const hue = ...` out of the `try` so both survive: )

```ts
    const hue = Math.floor(mulberry32(designSeed(`${host}:hue`, designNonce))() * 360);
    try {
      wireCss = (await generateWireStyle(brief, { hue })).css;
    } catch (e) {
      console.error(
        `[generate] styling failed for ${host}: ${e instanceof Error ? e.message : e}`,
      );
    }
```

Then extend the loop call at :202:

```ts
    await runDraftQualityLoop({
      host,
      facts,
      verticalId: vertical.id,
      media,
      templateId: site.templateId,
      dossier,
      styleBrief: brief,
      styleHue: hue,
    });
```

- [ ] **Step 2: Extend `runDraftQualityLoop`**

In `lib/site/inspect.ts`:

Add imports:

```ts
import { runStyleAudit } from "@/lib/design/style-audit";
```

(`buildSectionDigest` is already local to this file.)

Extend the opts type:

```ts
export async function runDraftQualityLoop(opts: {
  host: string;
  facts: BusinessFacts;
  verticalId: string;
  media?: SiteMedia;
  templateId?: string;
  dossier?: Dossier;
  /** Style-gate inputs (spec 2026-07-28). Absent → the style phase is skipped
   *  (legacy callers), the text loop runs unchanged. */
  styleBrief?: string;
  styleHue?: number;
}): Promise<void> {
```

Inside, after `if (!blocks.length) return;` insert the style phase kickoff — the model
verdict runs CONCURRENTLY with the first text inspection (≈0 added latency):

```ts
    // Style gate (spec 2026-07-28): kicked off alongside the first text
    // inspection; awaited after the text rounds so the two model calls overlap.
    const stylePromise =
      opts.styleBrief !== undefined && typeof opts.styleHue === "number"
        ? runStyleAudit({
            css: draft.wireCss,
            sectionDigest: sectionDigest(sectionEntries(blocks)),
            brief: opts.styleBrief,
            hue: opts.styleHue,
          }).catch((e) => {
            console.warn(`[style-audit] failed (fail-open): ${e instanceof Error ? e.message : e}`);
            return null;
          })
        : null;
```

After the existing `for (let round = 0; round < 2; round++) { ... }` loop (i.e. after the text rounds finish, before the closing `catch`), add the style save:

```ts
    const style = stylePromise ? await stylePromise : null;
    if (style) {
      // One CAS-gated write: blocks from the text rounds are already saved
      // above; this adds the audited css + report. The spread keeps every
      // other PageContent field (templateId, pocket, genToken, seo...).
      const styled = {
        ...draft,
        blocks,
        ...(style.css && { wireCss: style.css }),
        styleAudit: style.report,
      };
      let q = sb.from("pages").update({ draft_content: styled }).eq("id", page.id);
      if (draft.genToken) q = q.eq("draft_content->>genToken", draft.genToken);
      // .select("id") row-count check = the established CAS convention
      // (publish.ts patchGeneratedImages) — a stale CAS must log, not vanish.
      const { data: sRows, error: sErr } = await q.select("id");
      if (sErr) console.warn(`[style-audit] save failed (fail-open): ${sErr.message}`);
      else if (!sRows?.length)
        console.warn(`[style-audit] ${host}: stale genToken — newer generation won, report dropped`);
      if (style.report.flagged) {
        console.warn(`[style-audit] ${host} FLAGGED: ${style.report.correctiveNote ?? "final fail"}`);
      }
    }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → expected: clean.

- [ ] **Step 4: End-to-end generation smoke**

With dev running and Supabase + Anthropic env configured:

```bash
curl -s -X POST http://lvh.me:3000/api/dev/generate -H 'content-type: application/json' -d '{
  "host": "qa-smoke.lvh.me",
  "publish": false,
  "verticalId": "generic",
  "facts": { "businessName": "Тестова майстерня", "city": "Київ", "phone": "+380501112233" }
}' | python3 -m json.tool
```

(`publish: false` keeps the smoke draft-only; the route requires `facts.businessName` — see `app/api/dev/generate/route.ts:35`.)

Acceptance, all three:
1. dev-generate returns ok;
2. the dev-server log shows the gate ran and nothing failed: no `[style-audit] ... failed` lines (a `[style-audit] <host> FLAGGED` line is fine — that's the gate working);
3. the generated site renders styled in the editor frame `http://app.lvh.me:3000/edit/<host>/frame` (no grey wireframe = css survived the pipeline), and the draft row's `draft_content.styleAudit` exists — verify by adding one temporary `console.log(JSON.stringify(style.report))` next to the save (remove it before commit).

- [ ] **Step 5: Commit**

```bash
git add lib/site/inspect.ts lib/site/publish.ts
git commit -m "feat(qa-gate): run style audit inside the draft quality loop"
```

---

### Task 6: Gate the editor redesign action

**Files:**
- Modify: `app/app/(protected)/edit/actions.ts` (regenerate action, stylesheet block at :295-343)

**Interfaces:**
- Consumes: `runStyleAudit` (Task 4), `buildSectionDigest` (Task 4), `StyleAuditReport` via `PageContent` (Task 1).

- [ ] **Step 1: Audit the fresh sheet before saving**

In the regenerate action, after the `try { ... wireCss = (await generateWireStyle(brief, { hue })).css; } catch { ... }` block (:307-323) — note `brief` and `hue` are declared INSIDE that `try`; lift them out exactly as in Task 5 Step 1 (declare `const brief = ...` and `const hue = ...` before the `try`). Then add:

```ts
    // Style QA gate (spec 2026-07-28): the redesign action is the only editor
    // path that mints new CSS, so it gets the same audit as generation.
    let styleAudit: StyleAuditReport | undefined;
    if (wireCss) {
      const audited = await runStyleAudit({
        css: wireCss,
        sectionDigest: buildSectionDigest(site.blocks),
        brief,
        hue,
      });
      wireCss = audited.css;
      styleAudit = audited.report;
    }
```

with imports added at the top of the file:

```ts
import { runStyleAudit } from "@/lib/design/style-audit";
import { buildSectionDigest } from "@/lib/site/inspect";
import type { StyleAuditReport } from "@/lib/site/page-content";
```

And extend the `draft_content` update object (:330-341) with the report:

```ts
          ...(wireCss && { wireCss }),
          ...(styleAudit && { styleAudit }),
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → expected: clean.

- [ ] **Step 3: Smoke via the editor**

Dev running, log in as `ui-test+p1@3minsite.test` / `p1-test-Passw0rd` at `http://app.lvh.me:3000`, open an existing site's editor, trigger «Згенерувати ще раз» (redesign). Acceptance: action completes, the preview restyles, server log shows no `[style-audit]` errors. (This path spends real model calls — run once.)

- [ ] **Step 4: Commit**

```bash
git add "app/app/(protected)/edit/actions.ts"
git commit -m "feat(qa-gate): audit regenerated stylesheet in the editor redesign action"
```

---

### Task 7: Admin QA column

**Files:**
- Modify: `app/app/(protected)/(shell)/admin/page.tsx`

**Interfaces:**
- Consumes: `styleAudit.flagged` from `draft_content` (Task 1 shape).

- [ ] **Step 1: Load the flags**

In `loadAdminData()` (`admin/page.tsx:70`), add to the `Promise.all` array:

```ts
    sb.from("pages").select("tenant_id, draft_content->styleAudit").eq("slug", ""),
```

capture it as `qaRes` (extend the destructuring in order), then after the `sites` line build the map:

```ts
  const qaByTenant = new Map<string, { flagged?: boolean } | null>();
  for (const row of (qaRes.data ?? []) as { tenant_id: string; styleAudit: { flagged?: boolean } | null }[]) {
    qaByTenant.set(row.tenant_id, row.styleAudit);
  }
```

and return `qaByTenant` from `loadAdminData` + destructure it in `AdminPage`.

- [ ] **Step 2: Render the column**

Header row (after the `TG` `<th>`):

```tsx
                <th className="px-3.5 py-2.5">QA</th>
```

Body row (after the TG `<td>`):

```tsx
                    <td className="px-3.5 py-2.5">
                      {qaByTenant.get(s.id)?.flagged ? (
                        <Chip tone="danger">стиль</Chip>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build` → both clean. (Build here, not later: this is the last code task.)

- [ ] **Step 4: UI verification (required for UI change)**

Dev running, log in as the test user, open `http://app.lvh.me:3000/admin` (test user must be in `ADMIN_EMAILS` in `.env.local` — if not, add it and restart dev). Playwright screenshot:

```bash
node scripts/pw-shot.mjs http://app.lvh.me:3000/admin admin-qa-column.png
```

(Check `scripts/pw-shot.mjs` usage header first; it supports host-override flags.) Acceptance: the QA column renders; sites without a report show «—»; a flagged site (if any — you can hand-flag one by re-running the acid smoke against a test host) shows the red «стиль» chip; table still fits ≤1280 px without horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add "app/app/(protected)/(shell)/admin/page.tsx"
git commit -m "feat(qa-gate): admin QA column for style-flagged sites"
```

---

### Task 8: Docs + final verification

**Files:**
- Modify: `docs/architecture-brief.md` (journal entry)

- [ ] **Step 1: Journal entry**

Append a numbered journal entry to `docs/architecture-brief.md` (match the existing entry format — grep `journal` / the `#44` entry for style): the style QA gate decision — data-level (no browser, owner decision), lint strips the wire-style prompt contract violations incl. ALL `@media`, static contrast via structural pair map + OKLCH auto-fix, one bounded verdict + one regen, `styleAudit` draft-only field, flag = admin QA column. Reference the spec file.

- [ ] **Step 2: Full verification sweep**

```bash
export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"
npx tsc --noEmit && npm run build
```

Both clean. Re-run the Task 2 and Task 3 curl smokes (they are free — no model calls) to confirm nothing regressed.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture-brief.md
git commit -m "docs(architecture): journal the style QA gate (data-level, no browser)"
```
