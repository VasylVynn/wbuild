# Cleanup plan: wireframe becomes the only generation flow

> **Status:** DRAFT — awaiting owner approval before any stage runs.
> **Depends on:** `docs/superpowers/specs/2026-07-27-wireframe-styling-spike.md`

**Goal:** the model composes a page from the block library and writes that site's
stylesheet. There is no template choice, no design-DNA roll, no palette presets, no
skins. One structural wireframe, one generated design per tenant.

## Governing decisions (owner, 2026-07-27)

1. **Existing tenants are disposable.** All 44 rows are test data. Sites that stop
   rendering are acceptable collateral — no migration, no dual-path support, no
   back-compat for stored `templateId` / `skin` / DNA values. This removes the single
   largest source of work from this plan.
2. **Old templates stay in the code for now.** `components/templates/**` and their
   registry entries are not deleted. What gets removed is the *logic that routes to
   them*. They become unreferenced-but-present, to be deleted in a later pass once the
   wireframe has proven itself.
3. The wireframe is currently reachable via `WIRE_SPIKE=1`. Stage 1 inverts that: it
   becomes the default and the flag disappears.

## What must survive — do not touch

These are load-bearing and independent of the design layer:

- **The block registry and schemas** (`lib/blocks/**`). The wireframe is built on them;
  invariant #4 (one registry drives render + validation + AI + editor form) is what keeps
  the bottom-sheet field editor working, and that editor is the product's core UX for a
  non-technical owner. Removing it is what Base44 does and why their audience is
  different from ours.
- **Facts grounding** and the string-comparison post-validation (invariant #5).
- **`lead_form` force-injection** before `contacts` (invariant #7).
- **Draft / published split** (invariant #6) — a generated stylesheet is draft until the
  owner publishes.
- **`canonicalHostname`** as the source of absolute URLs (invariant #2).
- **`mulberry32` / `dnaSeed`** (`lib/theme/dna.ts`) — still needed to seed the hue anchor.
  The DNA *schema* and the roll machinery go; the PRNG primitives stay.
- **`lib/theme/contrast.ts`** — likely promoted from "authoring check" to "gate on
  model-written CSS". Decide in stage 3, do not delete in stage 2.
- The image pipeline, IG scrape, dossier, rate limits, admin kill-switch.

---

## Stage 1 — Wireframe becomes the default

Smallest change that makes the new flow real. Nothing is deleted yet, so this is trivially
revertible.

- `lib/site/publish.ts`: drop the `WIRE_SPIKE` env gate; always compose against the
  wireframe and always generate the stylesheet.
- Move `salonwire` from `experimentalTemplates` into `siteTemplates` as the sole entry the
  generation path uses, or bypass the registry lookup entirely — decide when writing the
  step, whichever leaves less dead branching.
- Give it a real name and description (it is currently labelled «експеримент» and warns
  against offering it to owners).
- Styling currently runs **inline** and adds 60–100 s. Move it behind `after()` like the
  logo adaptation, or accept the latency — the 504 lesson in `publish.ts` says inline work
  on the finalize path is how that incident happened. **Decide before shipping stage 1.**

**Done when:** onboarding with no env var produces a styled wireframe site.

## Stage 2 — Delete template selection

Everything that exists to let a model or a human choose a template.

| File | What goes |
|---|---|
| `lib/templates/shortlist.ts` | whole file |
| `lib/templates/registry.ts` | `shortlistTemplates`, `SHORTLIST_SIZE`, `templatesFor`, `TEMPLATE_IDS`, `experimentalTemplates` |
| `lib/ai/generate.ts` | `templateId` from `generationSchema`, `buildTemplateDoc`, `offeredTemplates`, the forced/unforced prompt branch |
| `lib/ai/onboard.ts` | `buildDesignCatalog`, the «ВИБІР ДИЗАЙНУ» prompt rule, `templateId` from `save_facts`, `templateLine` |
| `app/app/new/actions.ts` | `templateId` threading, `conversationId`-for-shortlist plumbing |
| `components/onboard/OnboardChat.tsx` | template chip, `template` state, the design-choice message |
| `app/app/(protected)/edit/actions.ts` | `brand.templateId` reads |

**This deletes work shipped earlier the same week** (`docs/superpowers/specs/2026-07-25-template-shortlist-design.md`). That is the correct outcome, not a regression: the shortlist solved same-template convergence, and the wireframe removes templates entirely. Mark that spec superseded rather than deleting it — it carries the diagnosis that led here.

**Watch for:** `conversationId` was threaded through `onboardTurn` / `onboardAction` /
`OnboardChat` *for the shortlist seed*. It may have other uses by then; check before
unthreading.

## Stage 3 — Delete the design-DNA machinery

| File | What goes |
|---|---|
| `lib/design/bundles.ts`, `lib/design/packs.ts` | whole files |
| `lib/theme/dna-roll.ts` | whole file (`rollDna`, `rollBundleDna`) |
| `lib/theme/dna.ts` | `designDnaSchema`, `DesignDNA`, `MOTION_IDS`, `pick` — **keep `fnv1a`, `dnaSeed`, `mulberry32`** |
| `lib/theme/presets.ts` | the 26 palettes, `THEME_PRESET_IDS`, `PRESET_FAMILIES` |
| `lib/theme/logo-palette.ts` | `logoPaletteFamily` — or repurpose: the logo's dominant hue is a better hue anchor than a seeded one |
| `lib/blocks/skins.ts` | whole file; drop `skin` from the block schema |
| `lib/site/publish.ts` | `juggleTemplateVariants`, `shuffleMiddles`, the templateTheme roll, the font-pair roll, the whole `themeWithDna` construction |
| `lib/ai/generate.ts` | `themePresetId` from `generationSchema` and its prompt rule |
| `lib/theme/font-pairs.ts` | pending the font decision — the spike fixed one font; if that holds, this goes |

**Decide during this stage:** does `contrast.ts` become a gate on generated CSS? If yes it
survives and gains a caller; if no, it goes with the presets.

**Decide during this stage:** `shuffleMiddles` currently randomises section order. The
model now composes order itself, so this is redundant — but confirm the model's ordering is
actually varied before removing the safety net.

## Stage 4 — Editor surfaces

| File | What goes |
|---|---|
| `components/editor/ThemePicker.tsx` | whole file (design-pack picker) |
| `app/app/(protected)/edit/design-actions.ts` | `switchDesignPack`, `rerollDesignAction` |
| `components/editor/EditorShell.tsx` | pack/skin/theme controls, `packId` state |
| skin picker («Вигляд» chips) | wherever it renders |
| `app/app/(protected)/(shell)/admin/packs/**`, `admin/templates/**` | whole routes |

**Replace with:** a «Змінити вигляд» action that re-runs the styling call with a new hue.
That is the owner-facing equivalent of what the pickers did, and it is the only design
control the new architecture actually has. Design it before deleting the old ones so the
editor never ships without any design control.

**Coordinate:** `components/editor/**` and `components/templates/**` are the ownership zone
CLAUDE.md flags as shared with a concurrent session. `git status` before touching.

## Stage 5 — Logo adaptation

`lib/media/logo-adapt.ts` keys `NAV_SURFACES` by `templateId` and hardcodes colour words
per template ("a soft rose-tinted light navigation bar"). With generated palettes those
descriptions are false for every site.

Options: derive the nav-surface description from the generated stylesheet's actual
background/foreground values, or drop adaptation and require transparent logos. Not a
deletion — a rework, and it needs its own small design pass.

## Stage 6 — Quality gate (NEW WORK, not cleanup)

Listed here because the cleanup is not safe to finish without it. With templates gone
there is no authored floor under the design: six spike runs looked good, nothing
guarantees the seventh. The shape already exists in the backlog as **H6** in
`docs/smart-chat-instagram-plan.md`, previously deferred by the owner — render →
screenshot → vision check → accept or regenerate.

Under the wireframe architecture H6 stops being an improvement and becomes load-bearing.
**Do not consider this migration complete without it.**

## Open items carried in

- **Structural sameness inside sections** (task #12): the model restyles but cannot
  restructure; a single team member in a four-column grid reads as lost. Needs either a
  constrained layout vocabulary via CSS custom properties (extending `--wire-split-order`)
  or per-section structural variants.
- **`wire.css` ships to every page.** `registry.ts` imports the wireframe module, so its
  ~4 KB lands in the shared CSS chunk. Harmless today; irrelevant once the wireframe is the
  only template.
- ~~Editor preview passes no `wireCss`~~ — **fixed 2026-07-27** (flagged by an automated
  stop-time review). `wireCss` is now a real field on `EditorData` and on the tenant
  `brand` type, so both the public render and the editor frame resolve it without casts.
  The editor preview shows the same styled site the visitor sees.

## Sequencing

Stages 1 → 2 → 3 → 4 are ordered by dependency: nothing in a later stage is reachable
until the earlier one lands. Stage 5 can run any time after 1. **Stage 6 gates
production**, not the cleanup.

Each stage ends green on `npx tsc --noEmit` and `npm run build`, with a live onboarding
run through the UI. Commit per stage, local only until the owner asks otherwise.

---

## Stage 7 — Port structural variants into the wireframe (owner-chosen, 2026-07-27)

Audited by a dedicated agent against all 11 retained templates plus direct reads of ~35
variant components (not just their names).

**The numbers.** ~79 raw `variants` entries collapse to **~18 genuinely distinct missing
structural layouts**. ~29 are cosmetic re-skins or duplicates and must NOT be ported — a
variant that differs only in colour, shadow, radius or animation is already covered by the
stylesheet the model writes. The wireframe's 16 defaults already carry the single most
common layout per block type.

**Ranked by impact:**

1. `lead_form` two-panel (pitch + form) — 7 templates, the most repeated pattern in the
   whole set and directly on the funnel
2. `contacts` two-panel (facts + accent panel) — 6 templates
3. `hero` centered, no side media — 5 templates
4. `switchback` as a card grid instead of a zigzag — 5 templates, changes the axis
5. `testimonials` split-feature (one large + list), and single-column large quotes — 3 each
6. `services` price list with dotted leaders — 3 templates
7. `hero` media-left / asymmetric ratio — 2 (beleza, spark)
8. `publications` dense divide-y list — 2
9. `services` bento, `faq` boxed grid, `contacts` full-width band, `team` row list — 2-3 each

All eighteen port **cleanly**: every one is a flex/grid rearrangement achievable inside
`wire.css`'s locked-structure contract. None needs framer-motion, decorative
sub-components, hardcoded English copy or template-specific CSS variables.

The plumbing is already complete — `buildTemplateDoc` (`lib/ai/generate.ts:191`) renders
`[layout: default | X | Y]` for any section that declares `variants`, and the generation
schema still carries a `variant` field. Declaring variants on a wireframe section is
enough for the model to see and choose them; no prompt or schema work is needed.

**Defect found in the wireframe itself:** it was copied from `salon` but took the wrong
default. Salon's own default hero is CENTERED with no side media; the wireframe's default
is media-right. Salon's `split` and `editorial` variants are both media-right too
(verified via `order-last`), i.e. re-skins of what the wireframe already has. So the port
should also restore centered-hero as a first-class layout.

**Unverified, flagged by the auditor:** `ferri` team list (inferred from the component
name, not read) and `beleza` inline lead-form (its code showed `flex-col`, contradicting
the name). Confirm both before porting.
