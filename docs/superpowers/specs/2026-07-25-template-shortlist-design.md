# Design: Seeded Template Shortlist (sub-spec A)

- **Date:** 2026-07-25
- **Status:** APPROVED — ready for implementation planning. Audited by an independent
  fresh-context review on 2026-07-25; all findings applied and all open questions
  resolved (§10).
- **Problem owner:** site owner observed that different grooming brands received the
  same template.
- **Shape:** a program of two sub-specs, built sequentially. **This document covers
  sub-spec A only** (template choice). Sub-spec B (per-template palettes) is outlined
  at the bottom and gets its own design + plan cycle.

---

## 1. Problem

Different businesses in the same niche receive the same site template. The owner's
instinct was to "give the AI more freedom" and to add per-template colour palettes the
AI can shuffle. Investigation showed the first half of that instinct is inverted — the
model already has maximal freedom, and freedom is exactly what produces the repetition.

## 2. Current state (verified 2026-07-25)

**The template is chosen in the CHAT, not in generation.**

`lib/ai/onboard.ts:310` instructs the onboarding agent: «ВИБІР ДИЗАЙНУ — твоя робота як
дизайнера: щойно відчув ХАРАКТЕР бізнесу, обери і передай templateId у save_facts».
The chosen id travels `save_facts.templateId` → client state, persisted into
`conversations.facts_state` → `generateDraftAction` (`app/app/new/actions.ts:94`, which
also mints the host via `uniqueSubdomain` at `:157` and forwards `templateId` at `:166`)
→ `generateDraft` → `generateSite`'s `forcedTemplate` (`lib/ai/generate.ts:306`). By the
time generation runs, the template is already fixed; `generate.ts:320` only picks when
the chat left it empty.

`finalizeAction` (`app/app/new/actions.ts:211`) is publish-only and plays no part in
template selection. There is no `generateAndPublish` — it was removed with the
design-pack path.

**The catalog offered to the chat is flat and unseeded.** `buildDesignCatalog`
(`lib/ai/onboard.ts:252-260`) lists all 11 templates every time. Identical-shaped
dossiers (same niche, same warm tone) therefore produce identical picks. This is
ordinary mode-seeking LLM behaviour, not a defect in the prompt.

**Template choice is the only design axis without a seed.** Every other axis is drawn
from `mulberry32(dnaSeed(host, nonce))` with repeat-avoidance against the previous roll:

| Axis | Location | Seeded |
|---|---|:---:|
| Section layout variants | `lib/site/publish.ts:158` | yes |
| Middle-section order | `lib/site/publish.ts:159` | yes |
| Starting `data-theme` | `lib/site/publish.ts:163-169` | yes |
| Font pair | `lib/site/publish.ts:173-182` | yes |
| **Template** | `lib/ai/onboard.ts:310` / `generate.ts:389` | **no** |

**`verticalIds` affinity does not differentiate.** Nine of eleven templates declare
exactly `verticalIds: ["generic"]`; only ferri (`["lawyer","generic"]`) and studio
(`["generic","lawyer","autoservice"]`) carry anything else. `pet-grooming` *is* a real
vertical (`lib/verticals/registry.ts:107`, selectable — `save_facts.verticalId` is
`z.enum(VERTICAL_IDS)` and `VERTICAL_IDS = Object.keys(verticals)`), but no template
lists it, so `templatesFor("pet-grooming")` returns `[]` and the
«(типовий вибір для цієї ніші)» hint in `buildDesignCatalog` never fires. Should a
groomer instead classify as `generic`, `templatesFor("generic")` returns all eleven and
the hint fires on every line — uniform noise. Either way the affinity carries no signal.

## 3. Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Who picks the template | **Code builds a seeded shortlist; the model picks from it** | Keeps "fits the business character" intelligence, breaks convergence |
| D2 | Shortlist construction | **Seeded draw, 4 of 11, no DB read** | Matches every other DNA axis; no query in the chat path, no race between concurrent onboardings |
| D3 | Regenerate behaviour | **Template stays pinned** (unchanged) | Template is the site's identity; "Перемішати дизайн" already covers variety |
| D4 | `verticalIds` affinity | **Not touched this cycle** | Reviving it requires hand-mapping 11×6 pairs and would *narrow* spread — it works against this wave's goal |
| D5 | Palettes | **Separate sub-spec, built after this one** | Hand-authored palettes live in `components/templates/**`, the parallel-session ownership zone |

Decisions carried into sub-spec B (recorded here so they are not re-litigated): palettes
are **hand-authored** (not hue-rotated, not mapped from the 26 classic presets); the
palette is chosen by a **seeded roll nudged by `logoPaletteFamily`**, not by the model;
palette and light/dark mode are **two orthogonal axes** (`data-palette` alongside
`data-theme`), so the visitor's light/dark toggle survives.

## 4. Design

### 4.1 Seed placement

The chat runs before a host exists — during the conversation there is only a
`conversations` row; the subdomain is minted later, inside `generateDraftAction`
(`app/app/new/actions.ts:157`). The only stable identifier available from the first turn
is `conversationId`, which survives resume from localStorage
(`components/onboard/OnboardChat.tsx:402`).

```
── chat (no host yet) ──────────────────────────────────
conversationId ──► mulberry32(dnaSeed(conversationId, 0))
                        │
                        ▼
              shortlistTemplates(rng, 4)
                        │
                        ▼
          model picks 1 of 4 → save_facts.templateId
                        │
                        ▼
      generateDraftAction mints host (:157) ──┐
                                              │
── generation (host exists) ──────────────────┘─────────
host + designNonce ──► existing DNA axes, unchanged
```

The shortlist must be **stable across turns of one conversation**. A catalog that
changed between turns would make the model's previously chosen template vanish from the
list mid-conversation.

**One transition is unavoidable and accepted.** `startConversation` is lazy and
fail-open (`components/onboard/OnboardChat.tsx:586-592`): if it fails, turn 1 runs with
`convIdRef.current === null` and therefore the full 11-template catalog, and turn 2
onward runs with the shortlist. The `save_facts.templateId` enum keeps all eleven ids
(§4.4), so a template picked on turn 1 stays valid afterwards — the model is never asked
to justify a choice that has disappeared. This is the one case where §4.1's stability
guarantee yields to fail-open, deliberately.

### 4.2 Components

**`lib/templates/registry.ts` — new pure helper**

```ts
export const SHORTLIST_SIZE = 4;

export function shortlistTemplates(
  rng: () => number,
  k: number = SHORTLIST_SIZE,
): SiteTemplate[]
```

Partial Fisher–Yates over `Object.values(siteTemplates)` driven by the supplied `rng`,
first `k` entries. `k >= registry size` returns everything.

The `rng` is a **parameter, not built inside**. `registry.ts` is deliberately not
`server-only` — the render path and the admin previews import it across the client
boundary — so it stays dependency-free and the caller owns seeding.

**`lib/ai/onboard.ts` — catalog narrowing**

- `buildDesignCatalog(vertical)` → `buildDesignCatalog(vertical, shortlist)` (`:252`).
- `buildOnboardSystem(args)` gains `conversationId?: string` and builds the rng.
- `onboardTurn(...)` (`:434`) gains `conversationId?: string` as a 5th optional
  parameter and forwards it.

**Both system-prompt entry points must be updated, and the fallback needs a client-side
change too.** The prompt is assembled in two places; updating only one silently diverges
the fallback from the streaming path:

| Entry | File | Has `conversationId` today? |
|---|---|---|
| SSE (primary) | `app/api/onboard/route.ts:333` | yes — the client already posts it (`OnboardChat.tsx:469`) |
| non-stream fallback | `lib/ai/onboard.ts:455` | **no** — must be threaded |

Threading the fallback touches three files:

- `app/app/new/actions.ts:34` — `onboardAction` already takes a 5th options argument
  `current?: { ready?, confirmed? }`; add `conversationId?: string` to that object rather
  than a sixth positional parameter, then forward it at `:65`.
- `lib/ai/onboard.ts:434` — `onboardTurn` gains `conversationId?: string`.
- `components/onboard/OnboardChat.tsx:754` — the fallback call site passes
  `{ ready, confirmed }` today and must pass `convIdRef.current` alongside. **Without
  this the fallback silently keeps the full catalog** — precisely the divergence this
  section warns about.

`app/api/dev/onboard/route.ts:25` also calls `onboardTurn` and is deliberately left
unchanged: the new parameter is optional, so that dev harness degrades to the full
catalog, which is correct for it.

**`lib/ai/generate.ts:320` — fallback path**

When the chat left no template pinned, `offeredTemplates` becomes a shortlist rather
than the full registry, so both paths behave consistently. This path runs after the host
exists, so it seeds from the host rather than the conversation — see §4.3 for the stream
it must use.

### 4.3 Separate rng stream on the generation fallback (correctness-critical)

Applies to the `lib/ai/generate.ts` path only. The chat path (§4.1) builds its own rng
from `conversationId` and shares no stream with anything, so it needs none of this.

**The hazard.** `generateSite` accepts an rng seeded by `dnaSeed(host, nonce)`
(`lib/site/publish.ts:133`) — currently as `_rng`, explicitly unused since the
design-pack path was deleted (`lib/ai/generate.ts:296-301`). `generateSite` runs at
`publish.ts:148`, *before* all four seeded draws at `:158-182`
(`juggleTemplateVariants`, `shuffleMiddles`, theme, font pair). So the naive fix —
"just use the `_rng` that's already there" — would consume from the shared stream and
shift every one of those four draws, meaning **stored nonces replay to a different
design** and existing sites shift on their next re-roll. The DNA-3 adversarial review
caught this exact class of bug ("motionId тягнеться на своїй до-DNA-3 rng-позиції").

**The constraint.** `generateSite` cannot build its own stream: its parameters are
`(dossier, verticalId, media, templateId, _rng)` (`generate.ts:282-301`) and the dossier
carries no host. Neither `host` nor `nonce` is in scope. The seeding therefore belongs
to the caller, and `generateSite` takes the shortlist rng as an explicit argument
separate from `_rng`.

`dnaSeed` is `fnv1a(\`${id}:${nonce}\`)` (`lib/theme/dna.ts:63`), so a named stream costs
nothing:

```ts
const tplRng = mulberry32(dnaSeed(`${host}:tpl`, nonce));
```

**Per-caller seeding.** `generateSite` has two callers that can leave the template
unpinned:

| Caller | Seeding |
|---|---|
| `lib/site/publish.ts:148` (`generateDraft`) | `host` and `nonce` are both in scope — build `tplRng` there and pass it |
| `app/app/(protected)/edit/actions.ts:324-329` (`regenerateSite`) | passes no rng — **deliberately falls open to the full catalog** (decision in §10.1) |

This makes the shortlist rng an *optional* argument whose absence is meaningful:

```ts
const offeredTemplates = forcedTemplate
  ? [forcedTemplate]
  : tplRng
    ? shortlistTemplates(tplRng)
    : Object.values(siteTemplates); // no rng → today's behaviour
```

`regenerateSite` therefore needs **no change at all** — its existing call shape already
produces the fail-open branch. That removes `app/app/(protected)/edit/actions.ts` from
the touch list.

The shared stream stays byte-identical in every branch: when the template is pinned
there is no shortlist draw at all, and when it is not, the draw comes from `tplRng`.

### 4.4 Degradation — fail-open everywhere

| Situation | Behaviour |
|---|---|
| `conversationId` absent | Catalog falls back to all 11 (today's behaviour). The chat never fails. |
| Model returns a `templateId` outside the shortlist | **Accepted.** It is a valid template; the shortlist constrains presentation, not validation. |
| Resumed conversation pinned to a template outside the shortlist | Works — the `save_facts.templateId` enum keeps all 11 ids. |
| Unknown id | Existing handling (`app/app/new/actions.ts:43` already sanitises). |
| No shortlist rng passed to `generateSite` | Full eleven-template catalog — today's behaviour. This is the `regenerateSite` path (§10.1). |

### 4.5 Prompt-cache cost (accepted)

The template catalog currently sits in the byte-stable static prefix of both prompts
(`lib/ai/onboard.ts:240-243`, `:308-309`; `lib/ai/generate.ts:322-324`, whose comment
states the catalog stays "byte-stable per vertical + template"). A per-conversation
shortlist moves the first volatile byte earlier in that prefix.

Consequences, accepted deliberately:

- **Within a conversation, caching is unaffected** — the shortlist is stable across
  turns, so the prefix stays byte-identical turn to turn. This is the case that matters,
  since onboarding is a multi-turn loop over a growing history.
- **Cross-conversation prefix sharing shrinks.** The onboarding system prompt is already
  volatile per conversation (`fieldList(vertical)`, `templateLine`, `issuesBlock`), so
  the loss is small, not new.
- **The unpinned generation menu becomes per-host** rather than per-vertical. That path
  runs at most once per site, so there was little reuse to lose.

## 5. Invariants respected (CLAUDE.md)

- **One-registry:** the shortlist is a read-only view over `lib/templates/registry.ts`;
  no template or field escapes the registry.
- **Facts grounding:** untouched. The shortlist changes only which templates are
  offered, never the copy or the requisites.
- **Publish is human-only:** untouched — this changes draft generation only.
- **Middleware never queries Postgres:** honoured by construction; D2 deliberately
  rejects the DB-backed anti-repeat variant, so no query is added anywhere.
- **Ownership zones — partially entered, honestly.** `lib/templates/**` *is* one of the
  zones CLAUDE.md names as frequently worked by a concurrent session, and `registry.ts`
  lives inside it. The change there is additive (one new exported pure function, no edits
  to existing template entries), but the implementation plan must still start with
  `git status` on that path and coordinate rather than collide. Zero edits under
  `components/templates/**` or `lib/blocks/skins.ts`; `components/onboard/OnboardChat.tsx`
  is touched but is not an ownership zone.

## 6. Files touched

- `lib/templates/registry.ts` — new `shortlistTemplates` + `SHORTLIST_SIZE`
- `lib/ai/onboard.ts` — catalog signature, `buildOnboardSystem` args, `onboardTurn` args
- `lib/ai/generate.ts` — shortlist on the unpinned fallback path; accept a shortlist rng
  argument distinct from `_rng`
- `lib/site/publish.ts` — build `tplRng` and pass it into `generateSite`
- `app/api/onboard/route.ts` — pass `conversationId` into `buildOnboardSystem`
- `app/app/new/actions.ts` — `onboardAction` accepts and forwards `conversationId`
- `components/onboard/OnboardChat.tsx` — fallback call site passes `convIdRef.current`

Deliberately unchanged: `app/api/dev/onboard/route.ts` (optional param, degrades to the
full catalog — correct for a dev harness).

## 7. Verification

The repo has no test suite (lint only), so determinism is proven by a throwaway script
run from the scratchpad — not committed:

| Check | Expectation |
|---|---|
| Same seed twice | Identical shortlist |
| Shape | Exactly 4 entries, no duplicates |
| Coverage over N=1000 synthetic ids | All 11 templates appear at least once |
| Distribution | No template in more than ~50% of shortlists (theoretical 4/11 ≈ 36%) |

**Regression on the DNA stream needs its own replay — `/api/dev/dna-check` cannot
detect this bug.** That route (`app/api/dev/dna-check/route.ts:71-77`) replays only
`rollBundleDna(tenantId, nonce)`, which is seeded independently and runs at
`publish.ts:125`, *before* the `mulberry32` stream is even created at `:133`. Its output
is identical whether or not the shared stream is broken.

A literal replay of the four draws is also impractical: `lib/site/publish.ts` opens with
`import "server-only"` and pulls in the Supabase client, so no standalone script can
import `juggleTemplateVariants` or `shuffleMiddles`.

**Diff inspection is the guard instead.** The failure mode to catch is a wiring mistake
at the call site — passing the design stream twice
(`generateSite(..., rng, rng)`) or transposing the last two arguments. Both compile,
both build, and both leave `_rng` unread in `generate.ts`, so only the call site itself
reveals them. `git diff lib/site/publish.ts` must show exactly two additions: the seed
const with the namespaced literal `` `${host}:tpl` ``, and a trailing `, tplRng` on the
existing `generateSite(...)` call — with the last two arguments reading `rng, tplRng` in
that order.

Note that stream isolation cannot be asserted from a script at all: two `mulberry32`
closures hold separate state, so they are isolated by construction and any such
assertion passes unconditionally. A script can only check that the two *seeds* differ.

Required before reporting done:

1. `npx tsc --noEmit` green
2. `npm run build` green
3. **Live smoke:** two separate onboarding conversations, same niche (grooming),
   different `conversationId` → different templates. One real `/api/onboard` call each.
4. Screenshot of both chats side by side, each naming the style it chose.

### Done means

1. **The two grooming conversations were offered different shortlists** — logged and
   compared. Different *picks* are the expected outcome but are not guaranteed: two
   shortlists of 4-of-11 share any given template with p ≈ (4/11)² ≈ 13%, so a
   mode-seeking model with a strong grooming favourite will still collide in roughly
   one pair in eight. **On a collision, inspect the two shortlists before debugging** —
   identical picks from different shortlists is a working implementation, identical
   picks from identical shortlists is a seeding bug.
2. tsc + build green
3. `publish.ts` diff inspected: exactly two additions, call ends `rng, tplRng)` (see above)
4. All four distribution checks pass
5. Zero edits under `components/templates/**`

### Verification results (2026-07-26)

Implemented in three commits on `wave-TPL3`: `4366c2c` (seeded draw), `c8780e2` (chat
catalog), `7834093` (generation fallback). Each passed an independent per-task review
with spec ✅ and quality Approved.

**Live evidence — two grooming onboardings, different conversations:**

| Conversation | Seeded shortlist (computed) | Designs the agent listed | Recommended |
|---|---|---|---|
| `dc044697-c063-4488-9cad-178a20ebfdf1` (Львів) | salon, aisaas, studio, portfolio | Салон, AI-SaaS, Студія, Portfolio | «Салон» |
| `6e3823b5-3d06-495c-8c6d-bfba8b3539fe` (Київ) | beleza, portfolio, ferri, nextly | Белеза, Портфоліо, Феррі, Некстлі | «Белеза» |

Both matched the computed shortlist exactly, **including order**. The two shortlists
overlap on `portfolio` only, and the two agents recommended different templates — the
original complaint (same template for different grooming brands) is resolved end to end.

**Fallback path proven, not assumed.** With `app/api/onboard/route.ts` renamed away, the
browser console recorded `404 … /api/onboard` and the non-stream fallback answered the
turn — listing the *same* four designs for the same `conversationId`. That is direct
evidence the two prompt-assembly paths do not diverge (§4.2).

**Note on the check itself:** the first run of the comparison script disagreed with the
agent on one of the four (computed `spark`, agent said `beleza`). The defect was in the
throwaway script, not the code: it replicated `Object.values(siteTemplates)` with
`restaurant` at index 7, whereas the registry's real key order puts it last
(`… react2021, spark, beleza, launch, restaurant`). Conversation 1 had drawn only from
indices 0–4 and so matched despite the error. Anyone re-running this check must take the
key order from `lib/templates/registry.ts` rather than assume it.

Gates at completion: `npx tsc --noEmit` green, `npm run build` green, `npm run lint` at
the repo's pre-existing warning baseline. No edits under `components/templates/**` or
`lib/blocks/**`.

## 8. Out of scope

- Per-template palettes (sub-spec B, below)
- Reviving `verticalIds` affinity (D4)
- Changing regenerate to re-roll the template (D3)
- D3.5 packs→bundles consolidation — related but independent; tracked in
  `docs/design-dna-plan.md`

## 9. Sub-spec B — per-template palettes (outline only)

Recorded so the direction is not lost; it gets its own design cycle.

- New `palettes: string[]` on `SiteTemplate`, hand-authored as
  `.tpl-<id>[data-palette="<name>"]` blocks. Five templates own a `.css` file under
  `components/templates/<id>/`; six (salon, aisaas, nextly, portfolio, react2021,
  restaurant) carry scoped tokens in `app/globals.css`.
- Rolled next to the existing theme and font-pair draws (`lib/site/publish.ts:163-182`),
  nudged by `logoPaletteFamily` — which today computes a value that template sites
  ignore, because it only nudges bundle choice on the classic path.
- Threaded via `TemplateBrand.dnaPalette` → `data-palette` on the wrapper, orthogonal to
  `data-theme` so the visitor's light/dark toggle (`SalonWrapper.tsx:63-72`) keeps
  working.
- **`NAV_SURFACES` must gain a palette dimension.** It is keyed by `templateId` alone
  (`lib/media/logo-adapt.ts:39-51`) and hardcodes colour words —
  `beleza: "a soft rose-tinted light navigation bar with dark text"`. A re-palettised
  beleza would make that description false and the logo would be adapted against the
  wrong background. Ordering is already correct: the palette rolls at `publish.ts:163-182`,
  logo adaptation runs later in `after()` at `:237`.
- Contrast: every authored palette runs through the existing `lib/theme/contrast.ts`
  AA checker, the same gate D3.1 applied to the 26 classic presets.
- This work lives in `components/templates/**` — coordinate with the parallel session
  before starting.

## 10. Questions raised by review — resolved 2026-07-25

1. **Legacy regenerate with no pinned template** (`regenerateSite`,
   `app/app/(protected)/edit/actions.ts:324-329`; `brand.templateId` is undefined on
   legacy pack sites per its own comment at `:313-316`) → **fail open to the full
   eleven-template catalog.** Rationale: it is a rare path (only sites generated before
   the template migration), and treating an absent rng as "no shortlist" means the
   editor needs no plumbing at all — see §4.3.
2. **Residual collision rate at k=4** (~13% of same-niche pairs share a given template)
   → **keep k=4.** Four candidates keep the model's pick genuinely characterful rather
   than forced. `SHORTLIST_SIZE` is a single constant, trivial to lower later if live
   results disappoint.
3. **Chat shortlist pinned to nonce 0**, so one conversation can never re-roll its four
   offerings → **accepted as designed.** Stability within a conversation is a
   requirement (§4.1), not a limitation; the owner changes the look in the editor after
   generation, and a fresh conversation draws a fresh shortlist.
