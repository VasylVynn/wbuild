# CLAUDE.md — 3minsite (repo: `wbuild`)

Operating manual for Claude Code sessions in this repo. Read once, then work.

## Product

**3minsite** — a multi-tenant AI site builder for Ukrainian small businesses (florists,
bakeries, salons, autoservices…). A non-technical owner chats with an agent, gets a real
website in minutes. **Core value = the lead form → the owner's Telegram.** Everything else
serves that funnel.

- **Product language is Ukrainian.** ALL user-facing copy (UI, chat, errors, emails,
  generated site text) MUST be Ukrainian. Code, comments, commits, docs stay English.
- Brand is mid-migration: older docs say **«Вітрина» / vitryna.com.ua** (placeholders in
  .env.example too); **production currently runs on `wizz-app.net`** (wildcard tenant
  subdomains); the target brand is **3minsite / 3minsite.com** (domains bought, migration
  pending — don't mass-rename yet).

## Commands

```bash
npm run dev          # next dev --turbopack, port 3000
npx tsc --noEmit     # typecheck (no "type-check" script — call tsc directly)
npm run build        # next build --turbopack
npm run lint         # eslint
npm test             # vitest run (~290 tests, node-only — NO jsdom)
```

**Vitest is node-only by design** (`vitest.config.mts`): pure modules, contracts, seeded
determinism. CSS/markup are NOT covered by it — UI claims need a live browser (see
Verification). `dev`/`build` use **Turbopack**.

**Local hosts** (root domain via `NEXT_PUBLIC_ROOT_DOMAIN=lvh.me:3000`; `*.lvh.me` → 127.0.0.1):
- `lvh.me:3000` — marketing root
- `app.lvh.me:3000` — dashboard / editor
- `<tenant>.lvh.me:3000` — a tenant site

## Architecture

**One Next.js 15 app (App Router, React 19) serves the platform AND every tenant site.**
A tenant is a **DB row, never a deploy**. Data-driven render: content is data
(`{blocks, templateId, wireCss}`), not pre-generated HTML.

- `middleware.ts` splits by `Host` header only: platform hosts (root, `app.`) pass through;
  every other host is a tenant → rewritten to `/s/<host>/<path>` (internal namespace
  `app/s/[host]/[[...slug]]`). Middleware inspects Host and **never touches Postgres**.
- `app/app/**` — dashboard/editor namespace. Route groups: `(protected)` = auth-gated,
  `(shell)` = dashboard chrome (leads, sites, admin). `edit/[host]/` is the editor;
  `edit/[host]/frame` is the live-preview iframe.
- `app/api/onboard`, `app/api/editor-chat` and `app/api/generate` are **SSE**
  (`text/event-stream`) streams. `/api/leads` (lead funnel), `/api/upload` (photos → Storage),
  `/api/telegram/webhook`, `/api/events` (analytics beacon). `/api/dev/*` are local-only helpers.
- **Generation is the staged pipeline v2** (`lib/site/pipeline.ts`, ONE module for onboard AND
  editor regen; spec `docs/superpowers/specs/2026-08-07-generation-pipeline-v2-design.md`):
  S0 deterministic photo-palette grounding → S1 design brief (`designSpec`: positioning,
  palette anchors, font pair, sectionPlan, motion level) → S2а stylesheet ∥ S2б blocks
  (parallel, `allSettled`) → S3 deterministic compile (lint-before-persist + reconcile + ONE
  draft write = the preview point) → S4 QA after the preview on its own budget. Transport:
  authed `POST /api/generate` (SSE stage events + `generation_progress` store). Every stage
  but S2б is fail-open; S1 fail → v1 path (no `designSpec`, renderer defaults).
- **Content states:** `pages.draft_content` vs `pages.published_content` — both carry the
  blocks AND the design (`templateId` + `wireCss` + `designSpec`), so a draft regeneration can
  never change the live site. Public render reads **published only**; editor reads/writes
  **draft only**. Draft-only keys (`pocket`, `styleAudit`, `designRationale`, `contentRev`)
  are stripped by `publishedFromDraft` (`lib/site/page-content.ts`) — new fields need exactly
  one decision there. No tenant-level theme: migration `0008` dropped the theme columns.
- **Edge cache:** per-tenant tags (`tenant:{host}`, `page:{host}:{slug}`) via `lib/cache.ts`.
  Draft-only saves must NOT purge. `revalidateTenant` is legitimately called by
  anything that changes the LIVE site: Publish, unversioned `brand` changes (logo), admin
  suspend/restore, admin test-generation. Never `revalidatePath` with a dynamic `[host]`
  segment — it nukes every tenant.

## HARD INVARIANTS — do not violate

1. **Images (§4.8 / journal #44): NO foreign image URLs on tenant sites.** Every image must
   live in our Supabase Storage `photos` bucket. `validateBlocks` (in
   `app/app/(protected)/edit/actions.ts`, via `stripForeignImages`) strips non-storage URLs on
   draft save; `sanitizeMedia` (`lib/media/media.ts`) enforces the storage-URL schema. **Models
   never see photo URLs during generation** — grounding is deterministic. What may be generated
   is decided by the SLOT and by what its HEADING claims (owner decision 2026-08-11):
   - **Owner photos only** — `services[].imageUrl`, `switchback[].imageUrl`. The model picks a
     `photoId`, and `assemble` (`lib/ai/generate.ts`) resolves it against the owner's own
     eligible photos; generated imagery never enters that map. A row whose id does not resolve
     loses its photo (services) or is dropped whole (switchback) — never filled with something
     else.
   - **`hero.imageUrl`** — decoration. May be generated, and the subject SHOULD be the
     business's own (a small dog for a grooming studio, a crust for a bakery): purely abstract
     textures produced beautiful pictures of nothing, which is what owners complained about.
   - **`gallery.images`** — mixed, and the ONLY slot where the heading does the work. The
     owner's own photos come first and are never displaced; generated tiles may top it up when
     there are too few (`GENERATED_GALLERY_COUNT`), and a gallery that receives any is
     force-titled «Наша атмосфера» (`GENERATED_GALLERY_TITLE`, `lib/site/pipeline.ts`). A
     model-chosen «Наші роботи» must never head imagery nobody made for this business — that
     retitle is the precondition for generating into a gallery at all.
   - Never, in any slot: people's faces, text/prices/logos, or an interior or facade that could
     be mistaken for their real venue.
2. **`canonicalHostname` is the source of ALL absolute URLs** (canonical, `og:url`, JSON-LD,
   sitemap, `metadataBase`) — never the request host, never a global platform domain. In the
   render path, host comes from rewrite **`params`**, not `headers()` (which kills ISR).
   Changing `canonicalHostname` is a cache event (purge old+new host tags, regen sitemap).
3. **Middleware NEVER queries Postgres per request** — Host inspection only.
4. **One-registry (`lib/blocks`):** the block schema drives render + validation + AI description
   + editor form. Never hand-code a per-block form; never let a block/field escape the registry.
   Generation returns validated structured JSON (Anthropic tool use w/ `input_schema`), not HTML.
5. **Facts grounding:** models must NOT invent business facts (phones, prices, addresses).
   User-confirmed facts (`tenants.facts`) are the source of truth; marketing wrapper copy may be
   generated, but requisites are copied 1:1 and post-validated by string comparison.
6. **Publish is human-only:** AI agents write to DRAFT; only the owner clicks «Опублікувати».
7. **Design is a generated stylesheet, not a choice.** Every site is composed against the ONE
   wireframe (`components/templates/salonwire`, `lib/design/wire-style.ts` writes its CSS).
   No template picking, no palette presets, no per-block skins, no design DNA — all deleted
   2026-07-27. `wire.css` owns layout/responsiveness; the generated sheet owns surface only.
   The single seeded axis is a hue anchor from `brand.designNonce` (`lib/design/seed.ts`).
   The eleven old templates stay in `components/templates/**` + `legacyTemplates` as porting
   source material — never generated into, never named to a model.
8. **`lead_form` is force-injected by code** before `contacts` in every generated site — not a
   model choice. `/api/leads` resolves tenant from the `Host` header (never the body); the lead
   is always persisted, Telegram push is best-effort.
9. **`contentRev` CAS for every async draft writer** (pipeline v2 §9): QA blocks/style, S4
   patches and the image-job draft patch all CAS on `draft_content.contentRev`
   (`lib/site/draft-cas.ts`, coalesce-0 for pre-v2 rows) + `genToken` identity. Never write a
   draft from an async job with a naked update. Published-copy patches stay on genToken CAS.
10. **Lint before persist:** a model stylesheet NEVER reaches `draft_content` raw —
    `compileWireCss` (lint + contrast repair + the 60k size clamp, `lib/design/css-size.ts`)
    runs in S3 before the first write. One size contract end-to-end: compile, audit prompt and
    render-side `sanitizeCss` all use `CSS_SIZE_LIMIT`; truncation is reported in
    `styleAudit.compileNotes`, never silent.
11. **One owner per tenant:** generation claims ownership atomically through the M1 claim gate
    (`lib/onboard/claim-gate.ts` + unique index in migration `0012`); a host claimed by another
    user is refused honestly, never co-owned. The gate fails CLOSED.

## Ownership zones — a PARALLEL agent may be editing these

`components/templates/**`, `lib/templates/**`, and the tenant-site visual
layer are frequently worked by a **concurrent session**. **Run `git status` before touching them**
and coordinate rather than collide. (These often show uncommitted changes at session start.)

## Verification — required before claiming done

1. `npx tsc --noEmit` — must pass.
2. `npm run build` — must pass.
3. **UI change:** drive the affected screen live (dev server, `lvh.me` hosts) with Playwright and
   take a screenshot. Typecheck passing ≠ UI working. Test user: `ui-test+p1@3minsite.test` /
   `p1-test-Passw0rd`.
4. **AI-flow change:** one real API smoke call through the changed path.
5. Commits: conventional, English, one logical unit each. Commit/push only when asked.

## Docs map — check before re-deciding anything

- `docs/architecture-brief.md` — decisions + journal + invariants (marked **ІНВАРІАНТ**).
  The authority; grep it before re-litigating a design choice. Sections referenced as §N above.
- `docs/data-model.md` — tables (`tenants`, `pages`, `leads`, `conversations`, rate/events) and
  *why*. Schema source of truth is the migrations.
- `docs/mvp-build-plan.md` — build status.
- `docs/ui-ux-redesign-plan.md` — UI redesign (P0–P5 done).
- `docs/smart-chat-instagram-plan.md` — next work.

## Practical notes

- **Supabase migrations are applied MANUALLY** in the Supabase SQL editor — there's no
  `DATABASE_URL` locally and no migrate script. Files: `supabase/migrations/0001…0012`. Assume
  the pipeline-v2 trio `0010`/`0011` (contentRev backfill, `generation_progress`, nonce RPC)
  and `0012` (one-owner unique index) may still be UNAPPLIED in a given environment — verify
  before relying on them; the code tolerates their absence fail-open except the claim gate,
  which fails closed by design.
- **Auth degrades open by design:** with no Supabase env, tenant-ownership gates treat everyone as
  a member (`lib/supabase/auth.ts` pattern §3.1). **Exception — `/admin` is fail-CLOSED**: gated by
  `ADMIN_EMAILS` env allowlist (`lib/admin.ts`), never a DB flag; no env → no admin.
- **Rate limits are env-tunable** (`lib/rate-limit.ts`): `RATE_LIMIT_DISABLED=1`,
  `RATE_LIMIT_<NAME>_MAX`, `RATE_LIMIT_<NAME>_WINDOW_SEC`. Storage is Postgres RPC with an
  in-memory fallback; every path **fails open** (limiting must never take the product down).
- **Verticals are DATA not code** (`lib/verticals`): `florist`, `bakery`, `lawyer`, `autoservice`,
  `generic` (fallback). **Site templates** (`lib/templates`, `components/templates`): `studio`,
  `ferri`, `salon`, `restaurant`. Adding one doesn't change generation code.
- Env: copy `.env.example` → `.env.local` (gitignored), restart `dev` after edits. Keys:
  `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `TELEGRAM_*`.
