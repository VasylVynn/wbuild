# 03 — Target Architecture: Lovable-grade generation on our platform

Synthesis of `01-evidence-lovable-vs-ours.md` (what failed, with quotes) and
`02-current-pipeline.md` (why, with file:line). This is the refactor design.
Old logic may be discarded — there is no production to protect.

---

## 0. Root cause: why Lovable "thinks" and ours doesn't

Lovable is a **general coding agent in a loop**: it scraped, then *inspected* the
raw JSON with python (keys, business fields, captions), reasoned about the data,
made explicit design decisions, downloaded images, and only then built. Freedom +
full data + iteration.

Ours is a **pipeline of starved single-shot calls**:

- The chat model never sees images, captions, or the scrape — only a text marker
  `[надіслано N фото]` and distilled facts. It was *prompted to deny* capabilities
  the pipeline demonstrably has (the trust-collapse loop, gap #1).
- The generation model sees **facts JSON + one tone adjective** and is asked to
  "write warm Ukrainian". Generic output is the expected output of that input.
- Everything rich — raw bio, per-post captions, OCR from photos, IG business
  fields, the owner's own phrasing in the transcript — is fetched and then
  **discarded before any model that writes copy can see it**.

**The fix is NOT to become a code generator.** Templates + one-registry +
multi-tenant rendering are our scale advantage (Lovable ships one bespoke React
app per customer; we ship a DB row). The fix is to give our models
**Lovable-level context and agency inside our structured output**:

1. **Persist everything, discard nothing** (Business Dossier).
2. **Agentic loops with honest tools** in both chats.
3. **Generation reads the full dossier**, not a compressed facts object.

---

## 0.1 Model tier decision (owner, 2026-07-22)

**`claude-sonnet-5` for every agent/model call** — chat (onboard + editor),
site generation, consistency post-pass, and photo intelligence. Replaces
`claude-sonnet-4-6` (CHAT/GEN) and `claude-haiku-4-5` (VISION) in
`lib/ai/anthropic.ts:14-19`.

Migration constraints (Sonnet 5 API surface):

- `thinking: {type: "enabled", budget_tokens: N}` returns **400** on Sonnet 5.
  Every current call must move to `thinking: {type: "adaptive"}` +
  `output_config.effort`: `app/api/onboard/route.ts:131` (budget 2000),
  `app/api/editor-chat/route.ts:265` (3000), `lib/ai/generate.ts:270` (6000).
- Omitting `thinking` now runs **adaptive by default** (4.6 ran thinking-off) —
  vision calls (`analyzePhoto`, logo verdict) should set an explicit choice:
  `{type: "disabled"}` or adaptive + `effort: "low"` for bounded tasks.
- Non-default `temperature`/`top_p`/`top_k` return 400 (we pass none — clean).
- New tokenizer: ~30% more tokens for the same text — give `max_tokens`
  headroom (onboard 6000, editor 8000, generation) and re-baseline costs.
- Effort mapping: generation + editor agent `high` (default); onboard chat
  `medium`; vision/consistency `low`.

Cost note: vision on Sonnet 5 is ~3× Haiku per call ($3 vs $1 /MTok input) at
20–40 vision calls per deep import — still cents per onboarding; accepted for
uniform quality (better OCR/extractedInfo matters for §1.4).

## 1. Data foundation: the Business Dossier

### 1.1 New table `ig_snapshots` (migration 0007)

```sql
create table ig_snapshots (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  tenant_id uuid references tenants(id),      -- re-linked at finalize, like conversations
  handle text not null,
  raw jsonb not null,          -- FULL untouched Apify payload (profile + posts)
  parsed jsonb not null,       -- our normalized view (see 1.2)
  scraped_at timestamptz not null default now()
);
```

- Written **server-side by the scrape route itself** — no more streaming to the
  client as the only copy (`ig-import/route.ts:157` today persists nothing).
- Multiple rows per conversation are fine (re-scrape = new snapshot); latest wins.
- `raw` means we can re-parse historical scrapes when the parser improves,
  without paying Apify again.

### 1.2 Parse keeps EVERYTHING

Replace the lossy `parseProfile` (`lib/ig/apify.ts:106-127`) with a full
normalizer. Per profile: handle, fullName, biography (raw, uncapped),
followersCount, postsCount, verified, isBusinessAccount, businessCategoryName,
externalUrl + bioLinks, businessPhoneNumber, businessEmail, avatar. Per post:
id, type (image/carousel/video), caption (raw), timestamp, likes/comments,
hashtags, location, ALL image URLs (carousel children), video thumbnail + url.

### 1.3 Deep scrape: two actors, ~20 posts

- Keep `apify~instagram-profile-scraper` for the profile + quick preview.
- Add `apify/instagram-post-scraper` (same async-run/poll pattern,
  `lib/ig/apify.ts:149-200`): last **20 posts with carousel children** — the
  profile scraper's `latestPosts` gives ≤15 posts, one image each, no children.
- Every image: `importExternalImage` (unchanged, §4.8) → **extended
  `analyzePhoto`** (1.4). Videos: analyze the thumbnail (MVP); frame extraction
  deferred.
- Concurrency 3–4 vision calls; whole pipeline inside `maxDuration=300`.
- Rate limits move from IP-only to **per-tenant**: `ig_scrape` (e.g. 5/day) —
  checked before any Apify spend.

### 1.4 Extended photo intelligence (`lib/media/analyze-photo.ts`)

Extend the forced-tool schema:

| Field | Purpose |
| --- | --- |
| `kind`, `suitable`, `reason`, `alt` | as today |
| `ocrText` | ALL visible text verbatim — not only review screenshots. This is where phones/addresses/prices printed on posts live (the "Перетворення чарівної Бульки" evidence). |
| `textHeavy: boolean` | lots of overlay text ⇒ unsuitable as a *site photo*, but valuable as an *info source*. Today this distinction doesn't exist. |
| `extractedInfo?` | structured candidates found in the image: `{phones[], prices[{name,price}], addresses[], hours?, promos[]}` |

**Persist ALL of it** in `photoMeta` (today `suitable`/`reason`/`warnings` are
dropped client-side — `02` §4) plus the post's `sourceCaption` attached
per-photo (today captions never join the photo — `02` §4).

### 1.5 `buildDossier()` — one context builder for every model

New `lib/dossier.ts`: assembles, from DB, the single rich-context document used
by **onboarding chat, generation, and editor chat** (three prompts, one source):

- Owner-confirmed facts (verbatim block — grounding rules unchanged).
- Latest IG snapshot `parsed`: bio raw, category, follower proof, bioLinks,
  business phone/email **as unconfirmed candidates**, per-post captions.
- Media inventory with per-photo TEXT metadata: id, kind, alt, sourceCaption,
  ocrText digest, textHeavy, suitable.
- Transcript digest: the owner's own phrasing (last N meaningful user messages) —
  today the one place the owner speaks in their own voice is invisible to
  generation (`02` §3.4).
- Brand-voice cues: handle morphology (@lapusigroom → «лапусики»), landmark from
  address («Чорновола»), tone evidence from captions.

---

## 2. Generation refactor

### 2.1 What stays (deliberately)

- One-registry (`lib/blocks`), templates as the structural skeleton, zod-validated
  `build_site` tool output — our scale advantage.
- Deterministic grounding: requisites copied 1:1 + string-checked; foreign image
  URLs stripped; `lead_form` force-injected; publish human-only.
- **Model never sees image URLs or pixels at generation.** Controlled relaxation:
  it now sees **per-photo TEXT metadata with stable ids** (kind, alt, caption,
  ocr digest) and *casts* photos by id ("hero: photo_3, gallery: 1,4,7 with these
  titles"); `assemble()` maps id→storage URL deterministically. Grounding stays
  deterministic; the model gains casting + captioning power. Document this as an
  amendment to §4.8, not a violation.

### 2.2 Richer `build_site` input (highest-leverage change, `02` §8.1)

Replace "facts JSON + tone line" (`lib/ai/generate.ts:239-248`) with the
**dossier digest** (1.5). Prompt additions:

- Brand-voice instruction derived from evidence, not a generic adjective.
- Per-photo casting duty: choose hero/gallery photos by id, write gallery
  `title`/`category` from real captions (slots already exist,
  `lib/blocks/schema.ts:87-93` — only wiring is missing, `02` §6).
- Anti-invention rule tightened: **no invented specifics** (durations, counts,
  guarantees) — only dossier-sourced specifics. (Gap #7: FAQ invented «1,5–3
  години».)

Keep it ONE call with extended thinking first (cheap, big win). A separate
"creative brief" stage is v2 if quality plateaus.

### 2.3 Consistency post-pass (new, cheap)

After `assemble()`: one Sonnet 5 call at `effort: "low"`, input = final copy + dossier, output =
violations list: invented specifics, cross-block contradictions (cat testimonial
vs «Котів не приймаємо» — gap #7), wrong-vertical wording («клієнтки»,
«краси й турботи про себе» on a groomer — gap #3). Auto-fix or drop offending
copy; log violations.

### 2.4 Registry additions (blocks are the gate, `02` §6)

| New block | Why |
| --- | --- |
| `map` | address → Google Maps embed + «Прокласти маршрут» (gap #4). Geocode-free iframe by address query. |
| `instagram_cta` | first-class «Написати в Direct» CTA + handle + follower proof (gap #4). For IG-native businesses this is a primary conversion path alongside lead_form, never instead of it. |
| gallery captions | wire `title`/`category` through `groundImages` (`lib/ai/generate.ts:610-622` currently overwrites to `{url, alt}`). |
| photo cap raise | gallery ≥12 / template-defined; stop silently discarding a third of the owner's photos (gap #5). |

Each enters via `lib/blocks` + template sections (one-registry). Templates get
the new sections where they make sense.

### 2.5 Verticals & template match

- Add verticals as data: `pet-grooming` now; classifier input gains IG
  `businessCategoryName` + bio (today it classified a groomer to `generic` and
  dressed it as a beauty salon — gap #3).
- Vertical contributes **copy patterns + section preset hints** to generation,
  not just one tone line (`02` §7).
- Template pick: model chooses with vertical-fit guidance; `beleza` gets an
  explicit "beauty only" fitness note.
- Delete the unreachable design-pack branch (`lib/ai/generate.ts:314-326`,
  `02` §6) or make it deliberate — dead code out.

---

## 3. Chat agents refactor

### 3.1 Onboarding → agentic loop (like editor-chat)

Convert `app/api/onboard/route.ts` from single-shot to the editor's loop pattern
(`app/api/editor-chat/route.ts:259-335`, MAX_LOOPS ~4). Server-side tools:

| Tool | Effect |
| --- | --- |
| `scrape_instagram(handle)` | full deep scrape (1.3), re-runnable on request («пошукай ще раз телефон») — snapshot persisted, digest returned as tool_result. Kills the client-side `igImportedRef` one-shot gate. |
| `analyze_image(photoId)` | re-run/read extended vision on a stored photo; returns ocr/extractedInfo. |
| `save_facts(patch, status…)` | as today, still last-wins merge. |

**Honest system prompt.** Remove every "я не можу відкривати посилання"
capability wall; replace with the real contract: can scrape IG on demand, can
read analysis of every uploaded/imported photo, cannot invent requisites. Gap #1
(self-contradicting denials) dies here.

**One-question flow.** With a deep scrape + dossier the default happy path is:
IG link → scrape → present the full proposal (facts + candidates from
bio/OCR/business fields: phone, address, hours) → owner confirms/edits **once**.
Candidates found in images/bio are offered as one-tap confirmations, never
re-typed (invariant 5 satisfied by confirmation, not by typing). Target ≤2 user
turns vs today's ~8 (gap #8).

### 3.2 Chat images actually analyzed

Today the model gets `[надіслано N фото]` (`lib/ai/onboard.ts:283-292`). Replace
with a per-upload digest injected into the turn: kind, alt, ocrText,
extractedInfo. User sends a price-list photo → model sees the extracted prices →
proposes `save_facts` patch → owner confirms.

### 3.3 Editor chat upgrades

- **Image path**: composer + route accept storage attachments (via existing
  `/api/upload`), same vision digest into context (today: no image path at all,
  `EditorChat.tsx:116`).
- New tools: `update_facts` (patch validated by `businessFactsSchema`, requisites
  string-checked — today facts are frozen post-publish), `refresh_instagram`
  (new snapshot + digest), `analyze_photo`, `list_photos`.
- Editor system prompt gets the dossier too (it already reads the transcript).

---

## 4. DB changes summary

| Change | What |
| --- | --- |
| `0007_ig_snapshots.sql` | table from 1.1 |
| `photoMeta` shape | extended fields (1.4) — jsonb, no migration needed; bump a `metaVersion` |
| `conversations` | unchanged (transcript already persisted; scrub rules stay) |
| `0006_editor_chats` | verify applied (CLAUDE.md flags it may not be) |
| `tenants` | optional `dossier_cache jsonb` later; start by building dossier on read |

---

## 5. Invariants: kept / amended

| # | Status |
| --- | --- |
| 1 Images storage-only | **kept** — all IG images re-hosted before use |
| 2 canonicalHostname | kept, untouched |
| 3 Middleware no-DB | kept, untouched |
| 4 One-registry | **kept** — map/ig_cta/captions enter via registry |
| 5 Facts grounding | **kept, UX changed**: scraped/OCR requisites are candidates confirmed with one tap; still 1:1 string-checked after confirmation |
| 6 Publish human-only | kept |
| 7 lead_form force-injected | kept — `instagram_cta` is additive, never a replacement |
| §4.8 "model never sees photos" | **amended**: never sees URLs/pixels; DOES see per-photo text metadata + casts by id (2.1) |

---

## 6. Phased delivery (each phase shippable)

**Phase 1 — Data foundation.** 0007 migration; full parser; posts actor (20
posts); extended `analyzePhoto`; persist snapshots + full photoMeta + captions.
No UX change yet. *Verify:* scrape @lapusigroom → snapshot row contains address,
phone-in-OCR, captions.

**Phase 2 — Generation on the dossier.** `buildDossier`; richer `build_site`
prompt + photo casting by id; gallery captions wired; consistency post-pass;
`map` + `instagram_cta` blocks; `pet-grooming` vertical; photo cap raise; delete
dead pack path. *Verify:* regenerate lapusigroom site → scorecard vs `01` gaps
3–7.

**Phase 3 — Agentic onboarding.** Loop + `scrape_instagram`/`analyze_image`
tools; honest prompt; one-question flow; kill `igImportedRef`; per-tenant rate
limits. *Verify:* replay the `conversations_rows.json` scenario — the
"пошукай ще раз телефон" request must succeed in one turn (gaps 1, 2, 8).

**Phase 4 — Editor chat power.** Image path + digest; `update_facts`,
`refresh_instagram`, `analyze_photo`, `list_photos`. *Verify:* send price-list
photo in editor chat → facts updated → contacts block refreshed.

**Scorecard:** after each phase, re-run the same @lapusigroom flow and score
against the 8 ranked gaps in `01-evidence-lovable-vs-ours.md`. Done = gaps 1–8
closed while keeping our advantages (prices, lead-form→Telegram, FAQ/timeline
depth, alt text — `01` §4).

---

## 7. Cost note

Deep scrape: 2 actor runs ($0.02–0.10) + ~20–40 Sonnet 5 vision calls
(effort low, ~$0.03–0.10) per onboarding — cents per site, bounded by
per-tenant rate limits. Generation stays 1–2 Sonnet 5 calls + 1 Sonnet 5
consistency pass at effort low (§0.1: Sonnet 5 everywhere).
