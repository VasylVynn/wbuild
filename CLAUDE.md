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
```

No test suite yet (only `lint`). `dev`/`build` use **Turbopack**.

**Local hosts** (root domain via `NEXT_PUBLIC_ROOT_DOMAIN=lvh.me:3000`; `*.lvh.me` → 127.0.0.1):
- `lvh.me:3000` — marketing root
- `app.lvh.me:3000` — dashboard / editor
- `<tenant>.lvh.me:3000` — a tenant site

## Architecture

**One Next.js 15 app (App Router, React 19) serves the platform AND every tenant site.**
A tenant is a **DB row, never a deploy**. Data-driven render: content is data (`{blocks, theme}`),
not pre-generated HTML.

- `middleware.ts` splits by `Host` header only: platform hosts (root, `app.`) pass through;
  every other host is a tenant → rewritten to `/s/<host>/<path>` (internal namespace
  `app/s/[host]/[[...slug]]`). Middleware inspects Host and **never touches Postgres**.
- `app/app/**` — dashboard/editor namespace. Route groups: `(protected)` = auth-gated,
  `(shell)` = dashboard chrome (leads, sites, admin). `edit/[host]/` is the editor;
  `edit/[host]/frame` is the live-preview iframe.
- `app/api/onboard` and `app/api/editor-chat` are **SSE** (`text/event-stream`) agent streams.
  `/api/leads` (lead funnel), `/api/upload` (photos → Storage), `/api/telegram/webhook`,
  `/api/events` (analytics beacon). `/api/dev/*` are local-only helpers.
- **Content states:** `pages.draft_content` vs `pages.published_content`; theme versioned at
  tenant level (`draft_theme` / `published_theme`). Public render reads **published only**;
  editor reads/writes **draft only**.
- **Edge cache:** per-tenant tags (`tenant:{host}`, `page:{host}:{slug}`) via `lib/cache.ts`.
  Draft-only content/theme saves must NOT purge. `revalidateTenant` is legitimately called by
  anything that changes the LIVE site: Publish, unversioned `brand` changes (logo), admin
  suspend/restore, admin test-generation. Never `revalidatePath` with a dynamic `[host]`
  segment — it nukes every tenant.

## HARD INVARIANTS — do not violate

1. **Images (§4.8 / journal #44): NO foreign image URLs on tenant sites.** Every image must
   live in our Supabase Storage `photos` bucket. `validateBlocks` (in
   `app/app/(protected)/edit/actions.ts`, via `stripForeignImages`) strips non-storage URLs on
   draft save; `sanitizeMedia` (`lib/media/media.ts`) enforces the storage-URL schema. **Models
   never see photo URLs during generation** — grounding is deterministic. Only genuine photos
   for real places/products/people (AI enhancement of light/color/crop OK); generated imagery
   is abstractions/textures/botany only, never a fabricated interior/facade.
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
7. **`lead_form` is force-injected by code** before `contacts` in every generated site — not a
   model choice. `/api/leads` resolves tenant from the `Host` header (never the body); the lead
   is always persisted, Telegram push is best-effort.

## Ownership zones — a PARALLEL agent may be editing these

`components/templates/**`, `lib/blocks/skins.ts`, `lib/templates/**`, and the tenant-site visual
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
  `DATABASE_URL` locally and no migrate script. Files: `supabase/migrations/0001…0006`. Assume
  `0006_editor_chats` may still be unapplied; verify before relying on `editor_chats`.
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
