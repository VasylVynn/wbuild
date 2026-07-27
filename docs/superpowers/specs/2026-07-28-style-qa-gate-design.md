# Style QA Gate — Design

**Date:** 2026-07-28
**Status:** Approved pending user review
**Owner area:** `lib/design`, `lib/site/inspect.ts` (quality loop), editor redesign action

## Problem

The design of every tenant site is a model-generated stylesheet (`generateWireStyle`,
`lib/design/wire-style.ts`). The prompt forbids layout-breaking CSS (`display`, `position`,
fixed widths, `@media` narrowing, external `url()`, `font-family`) and demands 4.5:1 text
contrast — but **nothing verifies the model obeyed**. A violation silently ships a draft
with broken mobile layout or unreadable text. The existing draft quality loop
(`runDraftQualityLoop`, `lib/site/inspect.ts:403`) checks TEXT only (invented facts,
contradictions, requisites, awkward empties); the stylesheet is never audited.

## Decisions (user-confirmed)

1. **Scope:** onboarding generation + editor-chat. Block edits in editor-chat already run
   `inspectDraft`; the style audit additionally hooks the **redesign action**
   (`app/app/(protected)/edit/actions.ts:295`) — the only editor path that produces new CSS.
2. **Timing:** blocking — the gate is a pipeline step; the user sees a checked result.
3. **Fix levers:** structured patches only. Code-side CSS transforms and re-calls of
   `generateWireStyle` with a corrective brief. The model NEVER writes raw CSS in the fix
   path (upholds invariant §7: design = generated stylesheet as a pure function of inputs).
4. **Fail criteria:** objective defects + gross aesthetics (acid combos, chaos). No taste
   rewrites.
5. **Fail policy:** bounded retries; on final fail keep the best variant and flag to admin.
   Draft-only risk — publish stays human (invariant §6).
6. **No browser anywhere.** No Playwright in prod, no external screenshot/browser services.
   The gate is data-level: it audits the generated CSS text and block data directly.
   (Screenshot/vision approach explicitly rejected by the owner.)

## Architecture

New module **`lib/design/style-audit.ts`** — pure functions, no DB access:

### 1. `lintWireCss(css): { cleanCss, violations }` — deterministic
Parse the generated sheet (postcss) and strip declarations that violate the wire-style
prompt contract:
- `display`, `position` (beyond wireframe's own), `float`
- fixed `width` / `height` / `min-width` on containers/cards
- `overflow` that hides content
- `@media` — v1 strips every `@media` block wholesale. `wire.css` owns responsiveness
  (invariant §7: the generated sheet owns surface only), so a generated breakpoint is
  suspect by definition; judging "narrows vs safe" statically is not worth the risk.
- `display: none` on sections or content
- `@import`, `url()` to external domains (only Supabase Storage / data: / relative allowed)
- `font-family` (single-font experiment)

Fix = delete the offending declaration (or whole at-rule). Code only, no model.

### 2. `auditContrast(css)` / `fixContrast(css)` — deterministic
The wireframe is singular and ours, so a static map of structural pairs
(text-class ↔ surface-class: hero title on hero bg, card text on card bg, …) is maintained
next to the audit. For each pair, resolve the effective colors from the generated sheet,
compute WCAG contrast. Below 4.5:1 → shift the TEXT color's OKLCH lightness (culori,
zero-dep) until the ratio passes. Targeted single-declaration rewrite, not a palette change.

### 3. `auditStyleWithModel(css, sectionDigest): { verdict, note }` — one bounded call
Same shape as `inspectDraft`: forced tool, `thinking: disabled`, low effort, small
max_tokens. Input: the generated CSS + the visible-text section digest. Output:
`pass | fail` + a short corrective note in Ukrainian ("картки зливаються з фоном секції").
Gross aesthetics only — the prompt forbids taste-level nitpicks.

## Integration into `runDraftQualityLoop`

```
draft upsert
└─ runDraftQualityLoop (extended):
   ├─ lint + contrast on draft.wireCss (deterministic, ms, always first)
   ├─ Promise.all: inspectDraft (text) ∥ auditStyleWithModel (style)  → +0 added latency
   ├─ text fixes as today (≤2 rounds, drop-don't-polish, protected types)
   ├─ style verdict fail → ONE regen: generateWireStyle(brief + corrective note, same hue)
   │    └─ re-lint + re-contrast the new sheet; regen passes → use it; regen also
   │       fails → keep the sheet with fewer lint+contrast violations (tie → original)
   └─ save via spread of draft_content + genToken CAS guard
```

- `brief` and `hue` are added to `runDraftQualityLoop` opts (already computed in
  `generateDraft`, `lib/site/publish.ts:121-122` — just passed through).
- Every save spreads the existing `PageContent` (templateId/wireCss/pocket/genToken
  survive — the file-header warning in `lib/site/page-content.ts` is the law).
- genToken CAS (same pattern as the deferred image job, `publish.ts:317`) so a stale loop
  never clobbers a newer generation.
- Second regeneration is forbidden. After one regen the better sheet ships; if still
  failing → flag.

**Redesign action** (`edit/actions.ts:295`): after its `generateWireStyle` call, run
lint + contrast + model audit with the same ≤1-regen budget before saving the draft.

## Data & persistence

- **Gate report → `draft_content.styleAudit`** (corrected: `pocket` is a `StoredBlock[]`,
  not an object — the report gets its own field):
  `PageContent` gains `styleAudit?: StyleAuditReport` =
  `{ lintViolations, contrastFixes, verdict, correctiveNote, regenerated, flagged, checkedAt }`,
  and `"styleAudit"` joins the `DRAFT_ONLY` list in `lib/site/page-content.ts` — stripped by
  `publishedFromDraft`, nothing leaks to live.
- **Admin flag** (corrected: `site_events.kind` has a DB CHECK constraint
  `('view','tel_click','contact_click')` and migrations are applied manually — a new kind
  would silently fail until someone runs SQL): the flag IS `styleAudit.flagged` in
  `draft_content`. The admin dashboard's sites table gains a "QA" column reading it.
  No new tables, no migration.

## Error handling — fail-open by contract (unchanged loop philosophy)

- CSS unparseable → skip lint, log, keep raw CSS.
- Regen call fails → keep current CSS, flag.
- Model audit error/timeout → treat as pass, log.
- The gate must never take generation down or block the user beyond the regen budget.

## Latency / cost budget

- Happy path: lint + contrast ≈ ms; model audit runs parallel to inspectDraft → ≈ +0 s.
- Fail path only: +20–40 s for the single stylesheet regen (16k max_tokens, high effort).

## Out of scope

- Any headless browser, screenshots, vision-model checks (rejected).
- Aesthetic scoring beyond gross-defect level.
- Gating manual (human) edits in the editor.
- Test runner: no vitest/jest added (user decision). Verification = `npx tsc --noEmit`,
  `npm run build`, live Playwright screenshot of the editor locally (dev-only script),
  one real API smoke through the changed generation path.

## Open questions

None blocking. Implementation details deferred to the plan: postcss availability as a
direct dependency vs transitive; exact structural-pair map contents (derived from
`wire.css` + `sections.tsx`); admin section placement.
