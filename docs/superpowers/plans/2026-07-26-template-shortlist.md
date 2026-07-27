# Seeded Template Shortlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop same-niche businesses receiving the same site template, by offering the onboarding agent a seeded 4-of-11 shortlist instead of the full catalog.

**Architecture:** The template is chosen by the onboarding chat agent, not by generation. A pure seeded draw (`pickN`) narrows the catalog the agent sees, seeded by `conversationId` so it is stable across turns and across resume. The generation fallback path (used only when the chat left no template pinned) gets the same narrowing, seeded from the host through a **separate named PRNG stream** so the four existing design-DNA draws replay byte-identically.

**Tech Stack:** Next.js 15 App Router, TypeScript, Anthropic SDK (Sonnet 5), `bun` for standalone sanity scripts.

**Spec:** `docs/superpowers/specs/2026-07-25-template-shortlist-design.md` — read §4 before starting.

**One deviation from the spec's file list.** Spec §6 puts `shortlistTemplates` in
`lib/templates/registry.ts` only. This plan adds `lib/templates/shortlist.ts` underneath
it, because `registry.ts` imports every template's React wrapper (`next/font`, CSS
side-effects) and therefore cannot be loaded by a standalone verification script. The
registry still exports `shortlistTemplates` exactly as the spec specifies; the new module
is the dependency-free draw beneath it. Rationale in Task 1.

## Global Constraints

- Node/npm are not on the default PATH. Prefix every command: `export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"`.
- There is **no test suite** in this repo — `npm run lint` and `npx tsc --noEmit` are the only checked-in gates. Pure logic is verified by throwaway `bun` scripts that are deleted before commit (repo precedent: the `parseOpeningHours` sanity run in wave D).
- Verification before claiming done: `npx tsc --noEmit` green, `npm run build` green.
- All user-facing copy stays **Ukrainian**. Code, comments and commit messages stay **English**.
- Commits: conventional, English, one logical unit each. **Do not push.**
- `lib/templates/**` is an ownership zone shared with a concurrent session — run `git status lib/templates components` before Task 1 and stop if there are foreign uncommitted changes.
- Never use `Math.random()` in the design path — every draw comes from a seeded `mulberry32`.
- `SHORTLIST_SIZE = 4` (decision §10.2 of the spec — do not change it while implementing).

---

### Task 1: Pure seeded draw + registry export

**Files:**
- Create: `lib/templates/shortlist.ts`
- Modify: `lib/templates/registry.ts` (append after `templatesFor`, currently ending at line 247)
- Verify: `scripts/shortlist-check.ts` (temporary — deleted in Step 6, never committed)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `pickN<T>(rng: () => number, items: readonly T[], k: number): T[]` from `lib/templates/shortlist.ts`
  - `SHORTLIST_SIZE: number` and `shortlistTemplates(rng: () => number, k?: number): SiteTemplate[]` from `lib/templates/registry.ts`

**Why the split:** `registry.ts` imports every template's React wrapper, which pulls in `next/font` and side-effect CSS imports. That makes it unloadable outside Next, so the combinatorial half lives in a dependency-free module that a plain script can import. The combinatorics also has no business knowing what a template is.

- [ ] **Step 1: Write the verification script**

Create `scripts/shortlist-check.ts` (in the repo, so `@/`-free relative imports and `node_modules` resolve; deleted at the end of this task):

```ts
import { pickN } from "../lib/templates/shortlist";
import { dnaSeed, mulberry32 } from "../lib/theme/dna";

const TEMPLATES = [
  "studio", "ferri", "salon", "portfolio", "aisaas", "nextly",
  "react2021", "restaurant", "spark", "beleza", "launch",
];
const K = 4;
const N = 1000;

let failures = 0;
const fail = (msg: string) => {
  console.error(`FAIL: ${msg}`);
  failures++;
};

// 1. Determinism: the same seed twice yields the same shortlist.
const a = pickN(mulberry32(dnaSeed("conv-abc", 0)), TEMPLATES, K);
const b = pickN(mulberry32(dnaSeed("conv-abc", 0)), TEMPLATES, K);
if (a.join(",") !== b.join(",")) fail(`determinism: ${a} vs ${b}`);

// 2. Shape: exactly K entries, no duplicates, all from the source list.
const counts = new Map<string, number>();
for (let i = 0; i < N; i++) {
  const list = pickN(mulberry32(dnaSeed(`conv-${i}`, 0)), TEMPLATES, K);
  if (list.length !== K) fail(`length ${list.length} on conv-${i}`);
  if (new Set(list).size !== list.length) fail(`duplicate in ${list}`);
  for (const id of list) {
    if (!TEMPLATES.includes(id)) fail(`unknown id ${id}`);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
}

// 3. Coverage: every template is offered at least once.
for (const id of TEMPLATES) {
  if (!counts.get(id)) fail(`never offered: ${id}`);
}

// 4. Distribution: no template in more than 50% of shortlists (expected 4/11 ≈ 36%).
for (const [id, n] of counts) {
  const share = n / N;
  if (share > 0.5) fail(`${id} over-represented: ${(share * 100).toFixed(1)}%`);
}

// 5. Seed namespacing: the tpl stream must not start from the design seed.
//    This asserts the SEEDS only. Stream isolation itself cannot be usefully
//    asserted here — two mulberry32 closures hold separate state, so they are
//    isolated by construction and any such check passes unconditionally. The
//    real risk is a wiring mistake at the publish.ts CALL SITE (passing `rng`
//    twice); Task 3 Step 7 is what guards that.
const HOST = "kvity-lviv";
const NONCE = 3;
if (dnaSeed(`${HOST}:tpl`, NONCE) === dnaSeed(HOST, NONCE)) {
  fail(`tpl seed collides with the design seed`);
}

console.log(
  failures === 0
    ? `PASS — ${N} draws, distribution: ${[...counts].map(([k, v]) => `${k} ${((v / N) * 100).toFixed(0)}%`).join(", ")}`
    : `${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun run scripts/shortlist-check.ts`

Expected: failure resolving the import — `Cannot find module '../lib/templates/shortlist'`. The module does not exist yet.

- [ ] **Step 3: Create the pure draw module**

Create `lib/templates/shortlist.ts`:

```ts
/**
 * Seeded shortlist selection — the combinatorial half of the template shortlist
 * (spec 2026-07-25 §4.2).
 *
 * Deliberately DEPENDENCY-FREE. `lib/templates/registry.ts` imports every
 * template's React wrapper, which pulls in `next/font` and side-effect CSS
 * imports, so it cannot be loaded outside Next. Keeping the draw here makes it
 * runnable from a plain script, and keeps the combinatorics ignorant of what a
 * template is.
 */

/**
 * `k` items drawn from `items` without repetition, driven by a seeded PRNG.
 *
 * Partial Fisher-Yates over a copy: `k` swaps, source array untouched. A `k` at
 * or above the input length returns a full permutation; a `k` below 1 returns
 * an empty array. Deterministic — the same PRNG state always yields the same
 * result, which is what makes the shortlist stable across turns of one
 * conversation.
 */
export function pickN<T>(rng: () => number, items: readonly T[], k: number): T[] {
  const pool = [...items];
  const take = Math.max(0, Math.min(k, pool.length));
  for (let i = 0; i < take; i++) {
    // Clamped so a PRNG that ever returns exactly 1 cannot index out of range.
    const j = Math.min(pool.length - 1, i + Math.floor(rng() * (pool.length - i)));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, take);
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `bun run scripts/shortlist-check.ts`

Expected: `PASS — 1000 draws, distribution: studio 36%, ferri 37%, ...` and exit code 0. Every share should sit near 36%.

If a share is far from 36%, the Fisher-Yates index is wrong — do not proceed.

- [ ] **Step 5: Add the registry-facing wrapper**

Append to `lib/templates/registry.ts`, after `templatesFor` (which ends at line 247):

```ts
/** How many templates the onboarding agent is offered (spec 2026-07-25 §10.2). */
export const SHORTLIST_SIZE = 4;

/**
 * A seeded subset of the catalog — what the onboarding agent gets to choose
 * from instead of all eleven templates (spec 2026-07-25 §4.2).
 *
 * The `rng` is a PARAMETER, not built here: this module is deliberately not
 * `server-only` (the render path and the admin previews import it across the
 * client boundary), so the caller owns seeding. Callers must use a stream
 * dedicated to this draw — see §4.3 of the spec.
 */
export function shortlistTemplates(
  rng: () => number,
  k: number = SHORTLIST_SIZE,
): SiteTemplate[] {
  return pickN(rng, Object.values(siteTemplates), k);
}
```

Add the import at the top of the file, next to the existing imports:

```ts
import { pickN } from "./shortlist";
```

- [ ] **Step 6: Typecheck, then delete the script**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"
npx tsc --noEmit
rm scripts/shortlist-check.ts
```

Expected: `tsc` reports no errors. The script is removed so it is never committed (spec §7).

- [ ] **Step 7: Commit**

```bash
git add lib/templates/shortlist.ts lib/templates/registry.ts
git commit -m "feat(templates): seeded shortlist draw over the template catalog"
```

---

### Task 2: Narrow the catalog the onboarding chat sees

**Files:**
- Modify: `lib/ai/onboard.ts` (`buildDesignCatalog` at 251-260, `buildOnboardSystem` at 262-310, `onboardTurn` at 434-439 and its `buildOnboardSystem` call at 455)
- Modify: `app/api/onboard/route.ts:333` (the SSE path's `buildOnboardSystem` call)
- Modify: `app/app/new/actions.ts` (`onboardAction` signature at 34-42, forward at 65)
- Modify: `components/onboard/OnboardChat.tsx:754` (the non-stream fallback call)

**Interfaces:**
- Consumes: `shortlistTemplates(rng, k?)` from Task 1; `mulberry32`, `dnaSeed` from `lib/theme/dna.ts`.
- Produces: `buildOnboardSystem` and `onboardTurn` both accept an optional `conversationId: string`; `onboardAction`'s 5th options argument accepts `conversationId?: string`.

**Why one task:** the four files are one deliverable. Landing the prompt change without the client fallback change would leave the non-stream path on the full catalog — the exact silent divergence the spec warns about in §4.2. A reviewer would reject the halves separately but accept them together.

**Do NOT narrow the `save_facts` tool schema.** The `templateId` enum in
`lib/ai/onboard.ts` must keep **all eleven** ids (spec §4.4). The shortlist constrains
what the agent is *shown*, never what it is *allowed to return*. Narrowing the enum would
make a resumed conversation — or a model that names an off-list template — fail
validation instead of degrading gracefully.

- [ ] **Step 1: Narrow `buildDesignCatalog`**

In `lib/ai/onboard.ts`, replace the function at 251-260:

```ts
/** B1: the design catalog the agent knows from the FIRST message (one-registry).
 *  `offered` narrows it to this conversation's seeded shortlist (spec 2026-07-25
 *  §4.2); absent or empty keeps every template — fail-open. */
function buildDesignCatalog(vertical: VerticalConfig, offered?: SiteTemplate[]): string {
  const affine = new Set(templatesFor(vertical.id).map((t) => t.id));
  const list = offered?.length ? offered : Object.values(siteTemplates);
  return list
    .map(
      (t) =>
        `- ${t.id} — ${t.label}: ${t.description}${affine.has(t.id) ? " (типовий вибір для цієї ніші)" : ""}`,
    )
    .join("\n");
}
```

- [ ] **Step 2: Seed the shortlist in `buildOnboardSystem`**

In the same file, add `conversationId` to the args object at 262-269 and destructure it at 270:

```ts
export function buildOnboardSystem(args: {
  vertical: VerticalConfig;
  facts: Partial<BusinessFacts>;
  templateId?: string;
  dossier: Dossier | null;
  issues: string[];
  apifyEnabled: boolean;
  /** Seeds this conversation's design shortlist (spec 2026-07-25 §4.1). Stable
   *  across turns and across resume; absent → the full catalog, fail-open. */
  conversationId?: string;
}): string {
  const { vertical, facts, templateId, dossier, issues, apifyEnabled, conversationId } = args;
```

Then, next to the other locals (just after the `templateLine` const at 279-281), add:

```ts
  // Nonce is fixed at 0: one conversation must always see the SAME four designs,
  // or the template the agent already picked could vanish from the list mid-chat
  // (spec §4.1, §10.3).
  const offeredTemplates = conversationId
    ? shortlistTemplates(mulberry32(dnaSeed(conversationId, 0)))
    : undefined;
```

And change the catalog interpolation at 309 from `${buildDesignCatalog(vertical)}` to:

```
${buildDesignCatalog(vertical, offeredTemplates)}
```

- [ ] **Step 3: Add the imports**

At the top of `lib/ai/onboard.ts`, extend the existing `@/lib/templates/registry` import to include `shortlistTemplates` and the `SiteTemplate` type, and add the PRNG import:

```ts
import { dnaSeed, mulberry32 } from "@/lib/theme/dna";
```

Verify the registry import line now covers: `TEMPLATE_IDS`, `getTemplate`,
`siteTemplates`, `templatesFor`, `templateDisplayName`, `shortlistTemplates`, and
`type SiteTemplate`. **`TEMPLATE_IDS` is already imported at `lib/ai/onboard.ts:15` and
feeds the `save_facts` tool's `templateId` enum at `:78` — dropping it breaks tsc.**
Only ADD what is missing; never rewrite the import down to this list.

**All line anchors in this task are pre-edit numbers.** Step 1's replacement is +3 lines
and Step 2 adds ~+9 more, so by the time you reach Steps 2-4 the anchors 262-270,
279-281, 309, 434-439 and 455 have shifted. Locate each edit by symbol name or by the
quoted surrounding string, not by line number.

- [ ] **Step 4: Thread it through `onboardTurn`**

In the same file, add the parameter at 434-439:

```ts
export async function onboardTurn(
  history: ChatMsg[],
  currentFacts: Partial<BusinessFacts>,
  currentVerticalId?: string,
  currentTemplateId?: string,
  conversationId?: string,
): Promise<OnboardTurnResult> {
```

and pass it in the `buildOnboardSystem` call at 455:

```ts
  const system = buildOnboardSystem({
    vertical,
    facts: currentFacts,
    templateId: currentTemplateId,
    dossier: null,
    issues,
    apifyEnabled: isApifyConfigured(),
    conversationId,
  });
```

- [ ] **Step 5: Pass it on the SSE path**

In `app/api/onboard/route.ts`, the `buildOnboardSystem` call at 333 already sits where `conversationId` is in scope (parsed at 112). Add the field:

```ts
          const system = buildOnboardSystem({
            vertical,
            facts: accum.facts,
            templateId: accum.templateId,
            dossier,
            issues: validateFacts(accum.facts, vertical).map((i) => i.note),
            apifyEnabled,
            conversationId,
          });
```

This call is inside the per-round rebuild loop. That is correct and required: the shortlist is a pure function of `conversationId`, so every round recomputes the identical four ids and the prompt prefix stays byte-stable.

- [ ] **Step 6: Accept it in `onboardAction`**

In `app/app/new/actions.ts`, extend the 5th argument at 39-41 and forward at 65:

```ts
  // Client-held flags, echoed back on refusals only (codex review): a
  // rate-limited fallback turn must not wipe ready/confirmed/template state.
  // `conversationId` seeds the design shortlist (spec 2026-07-25 §4.2) — carried
  // here rather than as a sixth positional parameter.
  current?: { ready?: boolean; confirmed?: boolean; conversationId?: string },
```

```ts
  return onboardTurn(history, facts, verticalId, templateId, current?.conversationId);
```

- [ ] **Step 7: Pass it from the client fallback**

In `components/onboard/OnboardChat.tsx`, the fallback call at 754 currently reads:

```tsx
          await onboardAction(modelMessages, facts, verticalId, template?.id, { ready, confirmed }),
```

Replace with:

```tsx
          await onboardAction(modelMessages, facts, verticalId, template?.id, {
            ready,
            confirmed,
            conversationId: convIdRef.current ?? undefined,
          }),
```

Without this the fallback keeps the full catalog while the streaming path shows four — the divergence §4.2 exists to prevent.

- [ ] **Step 8: Typecheck and build**

```bash
export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"
npx tsc --noEmit && npm run build
```

Expected: `tsc` reports no errors; the build completes with the route table printed.

- [ ] **Step 9: Commit**

```bash
git add lib/ai/onboard.ts app/api/onboard/route.ts app/app/new/actions.ts components/onboard/OnboardChat.tsx
git commit -m "feat(onboard): offer the chat agent a seeded 4-of-11 design shortlist"
```

---

### Task 3: Narrow the generation fallback, on its own PRNG stream

**Files:**
- Modify: `lib/ai/generate.ts` (signature at 282-301, `offeredTemplates` at 320)
- Modify: `lib/site/publish.ts` (after the `rng` const at 133; the `generateSite` call at 148)

**Interfaces:**
- Consumes: `shortlistTemplates` from Task 1.
- Produces: `generateSite(dossier, verticalId?, media?, templateId?, _rng?, tplRng?)` — a sixth optional parameter. Absent `tplRng` means the full catalog.

**The hazard this task exists to avoid:** `generateSite` runs at `publish.ts:148`, *before* the four seeded draws at `publish.ts:158-182` (`juggleTemplateVariants`, `shuffleMiddles`, the theme roll, the font-pair roll). Drawing the shortlist from the `rng` those four share would shift every one of them, so stored nonces would replay to a different design and existing sites would shift on their next re-roll. **Do not reuse `_rng`.**

- [ ] **Step 1: Add the parameter**

In `lib/ai/generate.ts`, append to the parameter list that currently ends with `_rng` at 296-301:

```ts
  // Seeded PRNG for the template shortlist (spec 2026-07-25 §4.3). A SEPARATE
  // stream from `_rng` on purpose: drawing from the caller's design-DNA stream
  // would shift every later draw in publish.ts and replay stored nonces to a
  // different site. Absent → the full catalog (regenerateSite's fail-open path).
  tplRng?: () => number,
```

- [ ] **Step 2: Narrow the offered catalog**

Replace line 320:

```ts
  const offeredTemplates = forcedTemplate ? [forcedTemplate] : Object.values(siteTemplates);
```

with:

```ts
  // Pinned wins; otherwise a seeded shortlist when the caller supplied a stream,
  // and the full catalog when it did not (spec 2026-07-25 §4.3, §10.1).
  const offeredTemplates = forcedTemplate
    ? [forcedTemplate]
    : tplRng
      ? shortlistTemplates(tplRng)
      : Object.values(siteTemplates);
```

Add `shortlistTemplates` to the existing `@/lib/templates/registry` import in this file.

- [ ] **Step 3: Build the named stream in publish.ts**

In `lib/site/publish.ts`, immediately after line 133 (`const rng = mulberry32(dnaSeed(host, dna.designNonce));`) add:

```ts
    // The template shortlist draws from its OWN named stream (spec 2026-07-25
    // §4.3). Sharing `rng` would shift the four draws below and replay stored
    // nonces to a different design — the DNA-3 review caught that exact bug.
    const tplRng = mulberry32(dnaSeed(`${host}:tpl`, dna.designNonce));
```

- [ ] **Step 4: Pass it**

Change line 148 from:

```ts
    const site = await generateSite(dossier, vertical.id, media, templateId, rng);
```

to:

```ts
    const site = await generateSite(dossier, vertical.id, media, templateId, rng, tplRng);
```

- [ ] **Step 5: Confirm `regenerateSite` was left alone**

Run: `grep -n "generateSite(" "app/app/(protected)/edit/actions.ts"`

Expected: the call passes at most five arguments and no `tplRng`. That is the deliberate fail-open path for legacy sites with no pinned template (spec §10.1) — **do not add a sixth argument there.**

- [ ] **Step 6: Confirm the shared stream is untouched**

Run: `grep -n "_rng" lib/ai/generate.ts`

Expected: `_rng` still appears only in the signature and its comment — never in the function body. If anything now reads `_rng`, the shared stream has been consumed and the regression this task guards against is live.

- [ ] **Step 7: Inspect the publish.ts call site — this is the real regression guard**

The two greps above cannot catch the worst mistake. An implementer who writes
`generateSite(dossier, vertical.id, media, templateId, rng, rng)` — passing the design
stream twice, or transposing the last two arguments — ships the exact regression this
task exists to prevent, and **tsc, the build, and both greps all stay green** (the two
parameters have the same `() => number` type).

The spec's §7 wording asks for a literal replay of the four draws. That is impractical:
`lib/site/publish.ts` starts with `import "server-only"` and pulls in the Supabase
client, so no standalone script can import `juggleTemplateVariants` or `shuffleMiddles`.
**Diff inspection replaces it.**

Run: `git diff lib/site/publish.ts`

Expected: exactly two additions, and nothing else —

1. the seed const, whose template literal must read `` `${host}:tpl` `` (namespaced), and
2. a trailing `, tplRng` appended to the existing `generateSite(...)` call.

Then confirm the call's last two arguments are **`rng, tplRng`** in that order, not
`rng, rng`, not `tplRng, rng`:

```bash
grep -n "tpl" lib/site/publish.ts
```

Expected output contains both the namespaced seed line and `..., rng, tplRng);`. If the
diff shows any other change to `publish.ts`, stop and re-read §4.3 of the spec.

- [ ] **Step 8: Typecheck and build**

```bash
export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"
npx tsc --noEmit && npm run build
```

Expected: both green.

- [ ] **Step 9: Commit**

```bash
git add lib/ai/generate.ts lib/site/publish.ts
git commit -m "feat(generation): seeded template shortlist on the unpinned path"
```

---

### Task 4: Live verification

**Files:** none modified. This task produces evidence, not code.

**Interfaces:** consumes the finished feature from Tasks 1-3.

- [ ] **Step 1: Start the dev server**

```bash
export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"
npm run dev
```

Expected: `ready` on port 3000. Onboarding lives at `http://app.lvh.me:3000/new`.

- [ ] **Step 2: Run two grooming onboardings**

Test user (CLAUDE.md): `ui-test+p1@3minsite.test` / `p1-test-Passw0rd`.

In two **separate** chats (clear site data or use a second browser profile between them so a fresh `conversationId` is minted), describe two different grooming businesses — e.g. «грумінг-салон у Львові, стрижка собак і котів» and «грумер у Києві, догляд за дрібними породами». Drive each until the agent states which design it chose.

Record for each: the `conversationId` and the chosen template. The id lives in
localStorage under key **`vitryna_conv_id`**, origin **`http://app.lvh.me:3000`**
(written at `components/onboard/OnboardChat.tsx:590`, read back at `:396`) — DevTools →
Application → Local Storage → that origin.

- [ ] **Step 3: Compute both shortlists and compare**

Recreate `scripts/shortlist-check.ts` from Task 1 Step 1 but replace the body with the two real ids:

```ts
import { pickN } from "../lib/templates/shortlist";
import { dnaSeed, mulberry32 } from "../lib/theme/dna";

const TEMPLATES = [
  "studio", "ferri", "salon", "portfolio", "aisaas", "nextly",
  "react2021", "restaurant", "spark", "beleza", "launch",
];
for (const id of ["<conversationId-1>", "<conversationId-2>"]) {
  console.log(id, pickN(mulberry32(dnaSeed(id, 0)), TEMPLATES, 4));
}
```

Run: `bun run scripts/shortlist-check.ts`, then `rm scripts/shortlist-check.ts`.

Expected: two lists of four ids. **The binding evidence is that the two shortlists differ**, and that each chat's chosen template is a member of its own shortlist.

Different *picks* are the expected outcome but are not guaranteed — two shortlists share any given template with p ≈ (4/11)² ≈ 13%, so a model with a strong grooming favourite still collides in roughly one pair in eight. Identical picks from **different** shortlists is a working implementation. Identical picks from **identical** shortlists is a seeding bug — chase that.

- [ ] **Step 4: Screenshot both chats**

Drive the two chats in Chrome and capture each at the turn where the agent names the chosen design. Save to the scratchpad. Typecheck passing is not evidence that the chat works.

- [ ] **Step 5: Verify the fallback path was not forgotten**

With the dev server running, force the non-stream fallback by renaming
`app/api/onboard/route.ts` to `route.ts.bak` — the client's `streamTurn` then 404s,
throws, and the `catch` at `components/onboard/OnboardChat.tsx:747-756` calls
`onboardAction`.

The catalog lives in the system prompt, so it is **not** visible in the reply. Make it
observable: send «Які дизайни ти можеш запропонувати?» and read the answer.

Expected: the turn is answered, and the reply names **at most four** styles, all of them
members of the shortlist computed for this conversation's id in Step 3. If it offers more
than four, or names a style outside that shortlist, Task 2 Step 7 was missed and the
fallback is still on the full catalog.

Restore the file afterwards: `mv app/api/onboard/route.ts.bak app/api/onboard/route.ts`.

- [ ] **Step 6: Final gates**

```bash
export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"
npx tsc --noEmit && npm run build && npm run lint
git status --short
```

Expected: all three green; `git status` shows no stray `scripts/shortlist-check.ts` and no modifications under `components/templates/**`.

- [ ] **Step 7: Record the outcome in the spec**

Append a short note to `docs/superpowers/specs/2026-07-25-template-shortlist-design.md` under §7: the two conversation ids, their shortlists, the two chosen templates, and any deviation from this plan.

```bash
git add docs/superpowers/specs/2026-07-25-template-shortlist-design.md
git commit -m "docs(spec): record template-shortlist verification results"
```

---

## Done means

1. The two grooming conversations were offered **different shortlists** (logged and compared — Task 4 Step 3)
2. `npx tsc --noEmit`, `npm run build`, `npm run lint` all green
3. The distribution script passed all five checks — determinism, shape, coverage,
   distribution, seed namespacing (Task 1 Step 4)
4. `_rng` is still unread in `lib/ai/generate.ts` (Task 3 Step 6), **and** the
   `publish.ts` diff shows exactly the two intended additions with the call ending
   `rng, tplRng)` (Task 3 Step 7 — this, not the script, is what proves the design
   stream was not consumed)
5. Zero edits under `components/templates/**`; `lib/templates/**` touched additively only
6. No `scripts/shortlist-check.ts` left in the tree

## Out of scope

Per-template palettes (spec §9 — its own cycle), reviving `verticalIds` affinity (§10 D4), re-rolling the template on regenerate (D3), and the D3.5 packs→bundles consolidation tracked in `docs/design-dna-plan.md`.
