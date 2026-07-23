# 02 — Current Site-Generation Pipeline (reality map)

Scope: the full path from confirmed facts to published blocks/copy, plus what
data we collect but throw away. Every claim is anchored to `file:line`. This
documents **reality**, not intent — it feeds a refactor where old logic may be
discarded.

Model tiers (`lib/ai/anthropic.ts:14-19`): generation = `claude-sonnet-4-6`,
onboarding chat = `claude-sonnet-4-6`, all vision = `claude-haiku-4-5`.

---

## 1. Generation call chain (end to end)

```
finalizeAction (app/app/new/actions.ts:79)
  └─ strips hasLogo/hasPhotos (:122-124), classifies vertical (:127-133),
     mints subdomain (:134), sanitizes media (:88)
  └─ generateAndPublish(facts, host, verticalId, publish, media, templateId)   lib/site/publish.ts:83
        ├─ rolls Design-DNA seeded by HOST+nonce (:99-126)  ← "same data ⇒ different site"
        ├─ generateSite(facts, verticalId, media, undefined, templateId, rng)  lib/ai/generate.ts:215   ← THE model call
        │     ├─ buildSystem(vertical, forcedTemplate)  (:153)  ← system prompt (persona, rules, template menu)
        │     ├─ userPrompt = block library + theme list + FACTS JSON  (:239-248)
        │     ├─ client.messages.create(model=sonnet-4-6, thinking 6000, tool=build_site, tool_choice auto)  (:263-275)
        │     ├─ generationSchema.safeParse(toolUse.input)  (:283)   ← strict zod, 2 attempts (:251)
        │     └─ assemble(blocks, facts, pack, media, template)  (:378)   ← deterministic post-pass (grounding, injection, placement)
        ├─ applies DNA skins / shuffles middles / juggles template variants  (:136-190)
        ├─ generateHeroImage(...)  IF no owner photos  (:199-222)   ← second model call (image), fed model's imageSubject
        ├─ tenants.upsert(brand, footer, facts, draft_theme, published_theme)  (:226-258)
        ├─ after(): deferred logo adaptation off the critical path  (:266-282)
        └─ pages.upsert(draft_content/published_content = {blocks, seo})  (:284-297)
```

Two model calls build the site: **`build_site`** (composition + all copy, one
tool call, `lib/ai/generate.ts:263`) and an optional **hero image** generation
(`generateHeroImage`, `lib/site/publish.ts:200`) only when the owner uploaded no
photos. A per-photo **vision** pass (`analyzePhoto`) ran earlier, during
onboarding — not at generation time.

---

## 2. What the generation MODEL can and cannot see

The model that writes every block and every line of copy receives **exactly
three things** (`lib/ai/generate.ts:239-248`, system at `:153-206`):

1. **The facts JSON** — `JSON.stringify(facts, null, 2)` (`:246`). This is the
   `BusinessFacts` object (`lib/verticals/schema.ts:28-49`): `businessName`,
   `city`, `phone`, `address?`, `hours?`, `viber?`, `telegram?`, `instagram?`,
   `about?`, `services[]?`, `testimonials[]?`, `socials[]?`.
2. **Static catalog docs** — the block-library description
   (`buildLibraryDoc`, `:110-119`), the vertical's allowed theme presets
   (`buildThemeDoc`, `:121-125`), and the full template menu with section lists
   and layout variants (`buildTemplateDoc`, `:133-151`).
3. **One-line vertical hints** — `vertical.label`, `personaHint`, and the tone
   line `genHint` interpolated into the system prompt (`:178-179`).

**The model canNOT see, by explicit design:**

| Signal | Proof it is withheld |
| --- | --- |
| Photo URLs / any image | `generateSite` doc comment: *"The MODEL never learns about photos"* (`lib/ai/generate.ts:218-221`); grounding is deterministic (`groundImages`, `:574`). |
| Per-photo vision `alt`/`kind` | `media.photoMeta` is consumed only in `assemble()`'s deterministic alt map (`:397-401`), never serialized into the prompt. |
| IG bio / post captions (raw) | Only the *distilled* `about`/`services` candidates survive into facts; raw text never reaches generation (see §4). |
| Conversation transcript | `generateSite` receives `facts, media, packId, templateId, rng` — no messages arg. The transcript is read back only by the **editor** agent (`app/api/editor-chat/route.ts:88-94`), never by generation. |
| Media inventory summary | `buildMediaInventory` (`lib/ai/onboard.ts:230`) feeds only the *onboarding* prompt, not generation. |

So the entire creative surface the generation model works from is the facts JSON
plus a one-line tone hint. That is the root of §3.

---

## 3. Where the copy comes from — and why it reads generic

**Grounded (copied 1:1, not written):** business name, phone, address, hours,
service names + prices, testimonial quotes/authors, messenger handles. Enforced
by the prompt (`lib/ai/generate.ts:189-194`) and re-forced deterministically in
`groundAndPlace` for contacts (`:772-789`) and `factPaths`
(`lib/blocks/schema.ts:385-401`). Prices are dropped, not placeholdered, when
absent (`:194`).

**Model-written ("creative"):** every headline, eyebrow, subtitle, section
title, service *description*, CTA label, FAQ, richText body, SEO title/desc. The
prompt's only steering for all of this:

> «Маркетинговий текст (заголовки, слогани, описи, заклики) — пиши сам, тепло,
> живою українською, доречно для ніші.» — `lib/ai/generate.ts:191`

> `Тон і акценти: ${vertical.genHint}` — `lib/ai/generate.ts:179`
> (e.g. florist: *"тепло й естетично; акценти на послугах, галереї робіт і
> відгуках"* — `lib/verticals/registry.ts:43`)

**Why it comes out generic — the causal chain:**

1. **The only business-specific narrative input is `about`**, and it is a short,
   compressed field. From IG it is capped at ≤300 chars in the tool and ≤400 on
   store (`lib/ig/extract.ts:51, 138`); from chat it is whatever the agent folded
   in. Everything the owner said about *what makes them different* is squeezed
   into this one string before the copywriter model ever sees it.
2. **No exemplars, no brand voice, no differentiation input.** The prompt gives a
   persona and a tone adjective, nothing about *this* business's positioning,
   competitors, or voice. Two florists in two cities get the same steering.
3. **The model is blind to the photos**, so it cannot describe real work, and
   gallery/hero copy is deterministic (`altBase = name + city`,
   `lib/ai/generate.ts:396`) — never evocative.
4. **The richest signal — the transcript — is discarded for generation.** The
   owner's own words survive only as structured facts; the phrasing, the stories,
   the enthusiasm are gone by the time copy is written (`conversations.messages`
   is *"INTERFACE only, not source of truth"*, `supabase/migrations/0001_init.sql:66`).
5. **SEO copy is formula-driven**: `«{головна послуга} у {місто} — {назва}»`
   (`lib/ai/generate.ts:197`), which is correct for SEO but reinforces sameness.

Net: the copywriter is asked to write "warm, lively Ukrainian, apt for the
niche" from a name, a city, a service list, and ≤400 chars of `about`. Generic
output is the expected output of that input.

---

## 4. Data-loss audit — everything we hold vs. what survives

Legend: **Model** = reaches the generation `build_site` model prompt;
**Assemble** = reaches the deterministic post-pass (grounded onto the site
without the model seeing it); **Persisted** = written to Postgres.

| Data we obtain | Source (file:line) | Persisted? | → Model? | → Assemble? | Discarded at |
| --- | --- | --- | --- | --- | --- |
| IG `username`/handle | `apify.ts:121` | `facts.instagram` (client sets) | yes (facts) | contacts/href grounding | — |
| IG `fullName` | `apify.ts:124` | via extraction → `businessName` | yes | — | — |
| IG `biography` (raw) | `apify.ts:124` | **no** (streamed raw to client `route:160`) | **no** (only distilled `about`) | no | server-side after extract |
| IG post `caption` (per-post) | `apify.ts:117` | **no** | **no** (only aggregated into `about`/`services`) | **no** (not attached to photo) | `extract.ts` after LLM pass; **not** in `ImportItem` (`route:138-143`) |
| IG `avatarUrl` | `apify.ts:124` | as photo/logo in `media` | no (image) | yes (hero/logo) | — |
| IG post images | `apify.ts:117` | re-hosted → `media.photos` | no (image) | yes | — |
| IG `followersCount`, `postsCount`, `verified`, `isBusinessAccount`, `businessCategoryName` | **not parsed** | **no** | **no** | **no** | `parseProfile` never reads them (`apify.ts:106-127`) |
| IG `externalUrl`/bioLinks | **not parsed** | **no** | **no** | **no** | `parseProfile` (`apify.ts:106-127`) |
| IG `businessPhoneNumber`, `businessEmail` | **not parsed** | **no** | **no** | **no** | `parseProfile` (`apify.ts:106-127`) — *and deliberately: extract refuses phones (`extract.ts:14-16`)* |
| IG post `likes`/`comments`/`timestamp`/`hashtags`/`location` | **not parsed** | **no** | **no** | **no** | `parseProfile` (`apify.ts:106-127`) |
| Photo vision `kind` | `analyze-photo.ts:177` | `media.photoMeta[].kind` | **no** | yes (gallery/hero routing; chat inventory) | — |
| Photo vision `alt` | `analyze-photo.ts:180` | `media.photoMeta[].alt` | **no** | yes (`altByUrl`, `generate.ts:397-401`) | — |
| Photo vision `suitable`/`reason` | `analyze-photo.ts:178-180` | **no** | no | no | client after routing (never stored in `media`) |
| Photo vision `reviewQuote`/`reviewAuthor` | `analyze-photo.ts:184-185` | only if user confirms → `facts.testimonials` | yes *iff confirmed* | — | client if unconfirmed |
| Photo `warnings` (sharp) | `analyze-photo.ts:186` | **no** | no | no | after client shows them |
| Full chat transcript | `conversations.messages` (`0001:66`) | **yes** | **no** | **no** (generation); read back by **editor** agent only (`editor-chat/route.ts:88-94`) | never reaches generation |
| User's raw message phrasing | client | distilled → `factsPatch` (`onboard.ts:350`) | only as structured facts | — | phrasing lost at `save_facts` distillation |
| `hasLogo`/`hasPhotos` flags | `schema.ts:47-48` | conversation only | **no** (stripped `actions.ts:122-124`) | no | before generation |
| Confirmed facts (`facts_state.facts`) | `persist-actions.ts:127` | `tenants.facts` at publish (`publish.ts:250`) | **yes** | yes | — |
| Chosen `templateId` | `facts_state.templateId` | `tenants.brand.templateId` | forces section menu | yes | — |

**Biggest losses for a "Lovable-grade" refactor:**
- **Post captions** — the single richest per-photo text signal — are used once
  for aggregate extraction, then thrown away. No per-photo caption ever reaches a
  gallery, even though `gallerySchema` has `title`/`category` slots
  (`lib/blocks/schema.ts:87-93`) that are never populated.
- **The transcript** never informs generation. The one place an owner speaks in
  their own voice is invisible to the copywriter.
- **IG business metadata** (external link, business email/phone, follower count,
  category) is dropped at the Apify parse boundary before anything downstream can
  use it.

---

## 5. Conversation & chat persistence (schema reality)

**`conversations`** (`supabase/migrations/0001_init.sql:62-73`):
- `tenant_id` → placeholder tenant (host=null) during onboarding, **re-linked**
  to the published tenant in `finalizeAction` (`actions.ts:156-161`).
- `messages jsonb` — transcript, explicitly *"INTERFACE only, not source of
  truth"* (`0001:66`). Attachments on messages are scrubbed to storage-only URLs
  before store (`persist-actions.ts:95-98`).
- `facts_state jsonb` — the actual state object
  (`persist-actions.ts:11-22`): `{ facts, verticalId, ready, confirmed?,
  templateId?, media? }`. **This** is what a resumed tab reads (`0001:68`), never
  a transcript replay.
- `is_complete boolean`.

What a real session leaves behind: `messages` = the full UI transcript;
`facts_state` = structured facts + vertical + chosen template + validated
`media` (logo, photos[], photoMeta[]). `tenants.facts` is written **once**, at
generation (`publish.ts:250`), from the confirmed facts.

**`editor_chats`** (`supabase/migrations/0006_editor_chats.sql`): one row per
tenant, `messages jsonb`. Per CLAUDE.md, **0006 may be unapplied** — the editor
route treats it as best-effort (`editor-chat/route.ts:37`, read at `:95`, write
at `:327`). The editor agent loads BOTH the onboarding transcript (last 30 msgs,
`editor-agent.ts:139-144`) and its own history as memory each turn.

**Does anything read the transcript back?** Only the **editor** agent
(`editor-chat/route.ts:88-94` → `buildEditorSystem(onboardingTranscript)`).
**Generation does not.** IG import reads `conversations` only to resolve the
tenant for photo scoping (`ig-import/route.ts:75-79`; `media/import.ts:129-134`)
and **persists no extracted facts server-side** — the `final` SSE event streams
them to the client (`ig-import/route.ts:157-163`).

---

## 6. How templates constrain generation

11 templates exist (`lib/templates/registry.ts:89-220`): `studio, ferri, salon,
portfolio, aisaas, nextly, react2021, spark, beleza, launch, restaurant`.

- **Section menu is fixed per template.** The model must set `templateId` and
  compose *only* from that template's sections; each block carries `section =
  <template section id>` and its type must match the section's `.block`
  (`lib/ai/generate.ts:168-176`). `assemble()` drops any middle block whose type
  maps to no section (`:425`) and caps **per section**, not per type (`:430-445`).
- **Copy slots are the block schemas**, unchanged by template — the template
  supplies layout/skin/variant, the block schema supplies the fields the model
  fills. A section may repeat once *only* if it has layout variants
  (`:438-440`), with a deterministic safety net forcing distinct variants
  (`:518-537`).
- **Template resolution always succeeds** →
  `forcedTemplate ?? model pick ?? getTemplate("studio") ?? first`
  (`lib/ai/generate.ts:293-297`). Because `getTemplate("studio")` always
  resolves, the **design-pack branch (`:314-326`) is unreachable dead code** in
  the current flow — `packsFor`/`randomPack` never run at generation. Worth
  noting for the refactor.

**Blocks the registry is MISSING (cannot be generated today):**
- **No map / embed block.** `contacts` is text + messenger buttons only
  (`lib/blocks/schema.ts:115-127`); there is no geo/map block type.
- **No Instagram-feed / IG-embed block**, and no first-class Instagram CTA block.
  An IG link only survives as a `contacts.instagram` href or a `socials[]` entry
  (`groundHrefs`/`allowedFactHrefs`, `lib/ai/generate.ts:648-663`).
- **No per-photo caption rendering.** `gallerySchema` *has* `title`/`category`
  per image (`:87-93`), but `groundImages` overwrites gallery images with
  `{url, alt}` only (`:610-622`) — captions/titles are never emitted. Captured IG
  captions have no path to the page.

Block type inventory (`lib/blocks/schema.ts:253-269`): hero, richText,
switchback, services, gallery, stats, testimonials, faq, cta, lead_form,
contacts, team, timeline, marquee, publications. `lead_form` is force-injected
(`:453-460`); `switchback` is always dropped at generation (no trusted per-item
image, `:419`).

---

## 7. What verticals contribute to generation

Verticals are data (`lib/verticals/registry.ts`). **Only 5 exist:** `florist`,
`bakery`, `lawyer`, `autoservice`, `generic` (fallback, `:106-122`). Per vertical:

| Field | Used where | Reaches generation? |
| --- | --- | --- |
| `label`, `personaHint` | system prompt persona (`generate.ts:178`) | yes |
| `genHint` (one-line tone) | system prompt (`generate.ts:179`) | yes — **the only tonal steering** |
| `advisorGuidance` | **onboarding only** (`onboard.ts:170`) | no |
| `themePresetIds` | theme allow-list in prompt (`generate.ts:243`, `buildThemeDoc`) | yes (favicon/OG theme only; template owns real look) |
| `priceRange` | fact validation (`onboard`/`validate`) | no |
| `exampleServices` | onboarding hint (never inserted as fact) | no |
| `imagePrompts` | legacy hero prompts — **appears unused**: `generateHeroImage` uses the model's `imageSubject` + `HERO_PROMPT_SUFFIX` (`publish.ts:200-207`, `registry.ts:15-21`), not `vertical.imagePrompts` | no |

**No grooming / pet vertical exists.** A pet-grooming business classifies to
`generic` (`classifyVertical`, `:132-139`; `getVertical` fallback `:127-129`),
so it gets the neutral persona, the generic tone line, and generic theme
presets. Adding a vertical is a data entry, but it only ever contributes a label,
a tone sentence, and a theme allow-list to generation — it does **not** inject
section presets or niche copy patterns into the generation prompt.

---

## 8. Constraints & opportunities (for the refactor — not a design)

**Structural constraints to respect:**
- Grounding is an invariant (§4.4/§4.8): requisites copied 1:1, foreign image
  URLs stripped, model never sees photo URLs. Any richer generation must keep
  facts verbatim and keep images deterministic.
- Publish is human-only; AI writes to draft (CLAUDE.md invariant 6).
- One-registry: blocks drive render+validation+form+AI schema; new content types
  (map, IG feed, captioned gallery) must enter via `lib/blocks` + a template
  section, not ad-hoc.

**Highest-leverage opportunities exposed by this map:**
1. **Feed the model more of the business.** Today it sees facts + a tone line.
   The transcript, the raw IG bio, and post captions all exist and are dropped
   before generation — routing even a summarized version of them into the
   `build_site` prompt is the most direct lever on copy quality.
2. **Stop discarding post captions.** They are per-photo, business-specific text
   already fetched (`apify.ts:117`) and already thrown away
   (`ig-import/route.ts` omits them from `ImportItem`). The gallery schema can
   already hold them (`schema.ts:87-93`); only wiring is missing.
3. **Widen IG extraction.** `parseProfile` drops external link, business
   email/category, follower proof — all legitimate site content — at
   `apify.ts:106-127`.
4. **The pack path is dead code** (`generate.ts:314-326` unreachable); the
   refactor can delete packs or make them reachable deliberately.
5. **Missing block types** gate obvious wins: no map, no IG embed, no captioned
   gallery. These are registry gaps, not model limits.
6. **Vertical coverage is thin** (5 niches) and verticals barely touch
   generation (one tone line). A refactor could let a vertical contribute copy
   patterns / section presets, not just a label.

---

### Appendix — key files

- `lib/site/publish.ts` — orchestrator (`generateAndPublish`).
- `lib/ai/generate.ts` — the generation model call, prompt builders, `assemble()`.
- `lib/ai/anthropic.ts` — model tiers.
- `lib/blocks/schema.ts` / `library.ts` / `registry.ts` — the block registry.
- `lib/verticals/registry.ts` / `types.ts` / `schema.ts` — verticals + facts.
- `lib/templates/registry.ts` — the 11 templates + section defs.
- `lib/media/media.ts` / `analyze-photo.ts` / `import.ts` — media + vision + re-host.
- `lib/ig/apify.ts` / `extract.ts` — IG scrape + fact extraction.
- `app/app/new/actions.ts` / `persist-actions.ts` — finalize + conversation persistence.
- `app/api/ig-import/route.ts` / `app/api/editor-chat/route.ts` — IG import + editor agent (transcript read-back).
- `supabase/migrations/0001_init.sql` / `0006_editor_chats.sql` — schema.
