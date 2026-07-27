# Spike: AI-styled wireframe — findings

- **Date:** 2026-07-27
- **Status:** SPIKE COMPLETE — findings recorded, nothing production-ready, nothing committed
- **Question:** given a responsive skeleton and full freedom over surface, does a model
  produce genuinely different designs per business — or does it converge the way it
  converged on templates?

## 1. What was built

Throwaway harness, deliberately outside the production path:

- `components/templates/salonwire/` — `salon`'s section inventory reduced to a
  structural wireframe: greys, no shadows, no radii, no motion, no decorative sections.
  Every element carries a stable semantic class (`wire-*`); **zero Tailwind colour
  utilities**, so a generated sheet never fights specificity.
- `wire.css` — the locked half of the contract: container ladder, breakpoints, grids,
  `display`/`flex-direction`/`grid-template-*`. The generated sheet owns surface only.
- `lib/design/wire-style.ts` — one Sonnet 5 call. Input: the wireframe's own source (so
  the model styles real class names) + a business brief. Output: a scoped stylesheet.
- `app/api/dev/wire-style/route.ts` + `app/dev/wire/[slug]/page.tsx` — generate and
  preview, dev-only.

**Safety:** `salonwire` is registered in a new `experimentalTemplates` record, **not** in
`siteTemplates`. Everything that offers a template to a human or to the model reads
`Object.values(siteTemplates)` — the generation catalog, the chat's design catalog and
`shortlistTemplates` — so an unfinished experiment physically cannot reach a real owner.
`getTemplate` still resolves it for the dev preview.

## 2. Results

| Question | Answer |
|---|---|
| Different designs across niches? | **Yes, completely** — three unrelated worlds |
| Responsive survives? | **Yes** — 375px, zero horizontal scroll, zero overflowing elements on every page |
| Same-niche convergence disappears on its own? | **No** — two grooming salons both landed in warm cream |
| Does a seeded hue anchor break that convergence? | **Yes** — 350° vs 150° produced genuinely different colour worlds |
| Does the anchor damage fit? | **No** — both still read as warm and caring |

Dominant colours, measured from the generated sheets rather than judged by eye:

| Run | Palette |
|---|---|
| grooming 1 (no anchor) | `#fff8f0` `#f3e3d3` `#ffe3d1` — warm cream/peach |
| grooming 2 (no anchor) | `#f6ead7` `#fbf3e4` `#d9c4a9` — warm cream/sand |
| auto service | `#ff6b1a` `#ffb400` `#38393e` — orange on near-black |
| law firm | `#6f5424` `#cfd7dc` `#f6f2e8` — brass, slate, cream |
| grooming, anchor 350° | `oklch(… 350)` rose accent on warm neutral |
| grooming, anchor 150° | `oklch(… 150/148)` sage accent on warm neutral |

The model invented business-appropriate decoration unprompted: paw-print pseudo-elements
for grooming, diagonal hazard stripes and a "6 МІС ГАРАНТІЇ" badge for the auto service,
thin brass rules for the law firm.

**Why a hue anchor and not a style direction.** A seeded *style* ("brutalist",
"organic") buys variety by breaking fit — brutalism contradicts a grooming salon's whole
promise. A hue does not: almost any hue can be made to feel caring at the right tone and
chroma. Given the anchor, the model made it the accent and kept a warm neutral base
rather than flooding the page with it — it still decides what suits the business; the
seed only displaces its default.

## 2a. Round two — full composition (owner request, same day)

The wireframe was extended to cover **all 16 block types** in `lib/blocks/schema.ts`
(the six that were missing: `stats`, `cta`, `marquee`, `publications`, `map`,
`instagram_cta`), and wired to the **production composition path**: `/api/dev/wire-site`
calls the real `generateSite` with `templateId: "salonwire"`, so the model picks which
sections the business needs, in what order, and writes the Ukrainian copy — then a second
call styles that composition.

Nothing about composition had to be invented: `build_site` already does this. The
wireframe simply exposes the whole library so nothing is unreachable.

| Business | Sections the model chose |
|---|---|
| Grooming salon (hue 350) | hero · **team** · services · timeline · **stats** · **marquee** · faq · map · cta · lead_form · contacts (11) |
| Law firm (hue 230) | hero · **stats** · services · timeline · faq · cta · map · lead_form · contacts (9) |

Different length, different order, different selection. The law firm got **no team
section** despite three named partners in the facts — the model put the numbers in the
hero instead, which is a defensible editorial call rather than an omission.

Content is real: prices copied 1:1 from facts (600/450/800/300 грн), a four-step
grooming visit flow, niche-appropriate FAQ.

**Timing for the full flow:** compose 44–79 s + style 66–70 s ⇒ **~2–2.5 min per site**,
~10.3k input / 8.6k output tokens on the styling call alone.

**One layout weakness spotted immediately:** a single team member renders inside a
four-column grid and reads as lost. Section layouts assume plural content; low counts
need their own treatment. Folded into open item 1.

### Forcing an experimental template — and the leak that first fix caused

`generateSite` validates the model's `templateId` against `z.enum(TEMPLATE_IDS)`, which
is `Object.keys(siteTemplates)` — so a forced experimental template failed validation.

**The first fix was wrong and was caught by an automated stop-time review.** It added
experimental ids to `TEMPLATE_IDS`, reasoning by analogy with the template shortlist:
"constrain presentation, not validation". The analogy does not hold. `TEMPLATE_IDS` feeds
**two tool schemas the model reads directly** — `build_site.templateId` and, worse,
`save_facts.templateId` in the onboarding chat. An enum value is a value the model may
choose whether or not any prose offers it, so a real owner could have been handed a grey
unstyled wireframe mid-conversation. The shortlist keeps all eleven ids valid because all
eleven are *shippable*; an experiment is not, so it must be excluded at the schema level,
not merely at the catalog level.

**The correct fix**, now in place: `TEMPLATE_IDS` stays production-only, and the
forced-template branch of the generation prompt tells the model **not to send
`templateId` at all**. That works because the field is `.optional()` and the code already
discards the model's value whenever a template is forced (`forcedTemplate ?? …`). Asking
a model to echo a constant the code throws away was pointless tokens and a pointless
failure mode; removing it is a small improvement to the production prompt in its own
right.

Verified after the fix: a forced `salonwire` generation still composes normally, and no
reference to `experimentalTemplates` exists anywhere under `lib/ai/`.

## 3. Cost

~$0.12–0.18 per site (Sonnet 5), 55–100 s, ~8.2k input / 6.6–10.5k output tokens. That
is **on top of** content generation (~35 s) → 1.5–2.5 min total, i.e. Base44's ballpark,
not faster.

**Correction to an earlier claim in this project's discussion:** "four variants to choose
from is free because design is a separate seeded axis" holds for the token/DNA approach,
**not** for this one. Here design is a model call again — four variants is four calls
(≈$0.6, ~100 s if run concurrently).

## 4. Open items

1. **Structural sameness inside sections** (owner, 2026-07-27). Across brands the
   internal layout of each section is identical — the AI restyles but cannot
   restructure. Section *order* is now solved (§2a: the model composes freely), so what
   remains is strictly intra-section. Candidate fix: a constrained layout vocabulary
   exposed as CSS custom properties the model may set — extending the
   `--wire-split-order` prototype (allowed column counts, card direction, media aspect,
   alignment paradigm) so variety is bought without granting access to `grid-template-*`
   or `flex-direction`. Alternative: 2–3 structural variants per wireframe section,
   chosen by seed or by the model.
   **Sub-case with evidence:** a single team member inside `wire-grid-4` reads as lost.
   Section layouts silently assume plural content; item counts of 1–2 need their own
   treatment, whichever fix is chosen.
2. **No quality gate.** Six runs all landed presentable; nothing guarantees the seventh.
   This is the single largest unsolved risk and the reason this cannot ship as-is. The
   shape of the fix already exists in the backlog as H6 (render → screenshot → vision
   check → accept or regenerate), previously deferred by the owner; under this approach it
   stops being an improvement and becomes load-bearing.
3. **Fixture content only.** Real long Ukrainian service names and real photographs will
   stress the layouts differently than `«Базова послуга»` and gradient placeholders.
4. **The model broke one instruction** — it set `font-family: serif` despite being told
   not to. Instructions are not absolute; anything that must hold needs a code-side gate.
5. **The prohibition list was too blunt.** `position` and `display` were counted as
   violations, but decorative pseudo-elements legitimately require them. The real test is
   rendered overflow, not the presence of a property name.
6. **Editor consequences unexamined.** The block schema survives, so the bottom-sheet
   field editor still works (this is the decisive advantage over letting the model write
   components). But the «Вигляд» / theme pickers lose their meaning and would need
   rethinking.

## 5. Storage — what is and is not true today

The generated stylesheet is **not** currently saved per client project in any production
sense. It is written to `.wire-spike/<slug>.css` (gitignored), keyed by an arbitrary test
slug, and read back by the dev preview. That was deliberate: the spike must not touch
tenant data to answer its question.

What exists towards real per-tenant storage: `TemplateBrand.wireCss` was added to
`lib/templates/registry.ts`, and `SalonWireWrapper` already injects it after the
wireframe's own CSS (with dev-grade sanitising — `@import`, `javascript:`, `expression(`
and stray tag-closers are stripped). So the render path is ready; only the write path is
missing.

For production this must respect invariant #6 (publish is human-only): a generated
stylesheet belongs in the tenant's **draft**, promoted to published only when the owner
clicks «Опублікувати» — the same draft/published split content already has.

## 6. How to reproduce

Dev server, then:

- `http://lvh.me:3000/dev/wire/none` — the grey wireframe, the "before" shot
- `/dev/wire/groom-h350` and `/dev/wire/groom-h150` — same business type, different anchors
- `/dev/wire/auto`, `/dev/wire/law` — different niches

```bash
curl -X POST http://lvh.me:3000/api/dev/wire-style \
  -H 'Content-Type: application/json' \
  -d '{"slug":"mytest","hue":210,"brief":"…"}'
```

`hue` is optional; omit it to let the model choose freely.

Screenshots from the run: `wire-00-before-grey.jpeg` … `wire-07-groom-sage.jpeg` in the
repo root (untracked).
