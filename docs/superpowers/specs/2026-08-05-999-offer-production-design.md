# Design: «Твій сайт за 999 грн» — production demand test

> **Date:** 2026-08-05. **Status:** APPROVED by owner (approach A).
> **Source:** `docs/idea-999-offer-test.md` + funnel code map (explorer report 2026-08-05).
> **Owner decisions:** ₴999 one-time = site + domain for 1 year (renewal offered later);
> free preview → payment gates publish; WayForPay on public test merchant until real
> merchant registered (env switch only).

## Goal

Production-ready paid funnel: ad → landing → onboarding chat → free generated preview →
pay ₴999 (WayForPay) → publish → pick domain → manual registration within ~4h.
Everything measurable (Meta Pixel + internal funnel events), logged, fail-safe.

## Non-goals (explicitly out)

Recurring payments; automatic domain registration (registrar API); Meta Conversions API;
Sentry; refund automation (manual via WayForPay cabinet); retargeting code (Ads Manager
config, not code); mass brand rename to 3minsite (migration pending, per CLAUDE.md).

## 1. Data (migration `supabase/migrations/0009_payments.sql`, applied manually)

- **`orders`**: `id uuid pk`, `tenant_id uuid fk→tenants`, `user_id uuid`,
  `order_reference text unique not null` (idempotency key for webhook),
  `amount numeric not null`, `currency text not null default 'UAH'`,
  `status text check in ('pending','paid','declined','refunded','expired') default 'pending'`,
  `wfp_payload jsonb`, `created_at`, `updated_at`, `paid_at timestamptz`.
  Indexes: `tenant_id`, `order_reference` (unique). RLS: service-role only (same pattern
  as `leads`).
- **`tenants` new columns**: `paid_until timestamptz null`,
  `custom_domain text unique null`, `requested_domain text null`,
  `domain_status text not null default 'none' check in ('none','requested','active')`.
- **`funnel_events`**: `id uuid pk`, `kind text not null` (NO check constraint —
  flexibility; distinct from visitor-facing `site_events` which keeps its CHECK),
  `tenant_id uuid null`, `conversation_id uuid null`, `meta jsonb`, `created_at`.
  Index on `(kind, created_at)`.
- **Backfill (grandfathering)**: ~~existing tenants with `status='published'` get
  `paid_until = now() + interval '10 years'`~~ — REMOVED and reverted 2026-08-06: with
  publishing free, `paid_until` means «may order a custom domain», and the grandfather
  would have handed old tenants free domains. Migration 0009 now nulls those values
  unless the tenant has a genuinely paid order.
- `tenants.status` enum unchanged — payment state lives in `paid_until`, orthogonal to
  lifecycle status.

## 2. Payments (WayForPay Purchase, hosted page)

- **`lib/payments/wayforpay.ts`** (pure, unit-tested):
  - `buildPurchaseFields(order)` → field map incl. HMAC-MD5 signature
    (merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;
    productName;productCount;productPrice — per WayForPay docs; implementation agent MUST
    fetch current official docs, not trust memory).
  - `verifyServiceSignature(payload)` — webhook HMAC verification.
  - `buildServiceResponse(orderReference, status)` — signed accept response.
  - Env: `WAYFORPAY_MERCHANT_ACCOUNT`, `WAYFORPAY_MERCHANT_SECRET`,
    `WAYFORPAY_MERCHANT_DOMAIN`, `PRICE_UAH` (default 999). `.env.example` documents the
    public WayForPay test-merchant credentials.
- **`createCheckoutAction(host)`** (server action, `app/app/new/` or shared lib):
  auth required + `requireMember` + new rate limit `checkout` → insert `orders` row
  (`order_reference = wfp_<tenantId-short>_<nanoid>`) → return form fields; client
  auto-submits form POST to `https://secure.wayforpay.com/pay` (same tab).
- **Webhook `app/api/payments/wayforpay/route.ts`** (serviceUrl):
  verify signature (invalid → log + 200 with decline body, never throw HTML);
  look up order by `order_reference`; idempotent transition (`paid` stays `paid`);
  on Approved: `orders.status='paid'`, `paid_at`, store payload,
  `tenants.paid_until = now() + 1 year`, `funnel_events(payment_success)`,
  best-effort Telegram push to `ADMIN_TELEGRAM_CHAT_ID` («Нова оплата ₴999: host»).
  Webhook is the source of truth. **Fail-closed**: no valid signature → no paid state,
  ever. Missing env → checkout creation errors visibly (Ukrainian message), webhook
  rejects.
- **Return page `app/app/pay/result/page.tsx`** (returnUrl): polls order status via
  server action (rate-limited), shows «Оплата пройшла» / «Не пройшла, спробувати ще» in
  Ukrainian; on paid → CTA back to publish/domain step. UX only — never mutates paid
  state itself.

## 3. Paywall gate

> **SUPERSEDED 2026-08-06 (owner decision).** Publishing is now FREE: the gate,
> `opts.bypassPaywall` and `PAYWALL_DISABLED` are deleted from `publishDraft`, and
> `finalizeAction` / `publishSite` no longer return `paymentRequired`. The ₴999 gates the
> CUSTOM DOMAIN instead — `requestDomainAction` (`app/app/new/domain-actions.ts`) reads
> `tenants.paid_until` and fails CLOSED, and the payment panel lives inside `DomainStep`
> on the onboarding success screen. §4's domain flow is unchanged apart from being paid,
> and §2 (WayForPay) and §5 (analytics) still hold. Everything below in THIS section is
> historical.

- Inside **`publishDraft`** (`lib/site/publish.ts`) — single choke point covering BOTH
  entries (`finalizeAction`, `publishSite`): if not (`paid_until > now()`) → return
  `{ok:false, error:'payment_required'}`.
- `opts.bypassPaywall: true` passed ONLY by admin test-generation
  (`app/app/(protected)/(shell)/admin/generate/actions.ts`) and `/api/dev/*` helpers.
- `PAYWALL_DISABLED=1` env for local dev (documented in `.env.example`); production
  default = enforced. Note asymmetry vs rate limits: rate limits fail open, paywall
  fails CLOSED.
- UI handling of `payment_required`:
  - Onboarding `OnboardChat`: publish click → payment screen (offer summary: «Сайт +
    домен на 1 рік — 999 грн») → WayForPay → back → auto-retry `finalizeAction` → domain
    step.
  - Editor `EditorShell`: same contract, modal variant.
- Add missing rate limit on editor `publishSite` (explorer finding: it has none) —
  new limiter `publish`.

## 4. Domain flow (post-payment)

- Step «Домен» after successful publish: input desired name → `checkDomainAction`
  (rate-limited `domain_check`): RDAP availability lookup (gTLD via rdap.org;
  .ua/.com.ua via hostmaster RDAP), graceful «не вдалося перевірити» on failure →
  user confirms → `tenants.requested_domain`, `domain_status='requested'`,
  `funnel_events(domain_requested)`, Telegram push to admin → UI promise
  «Сайт буде на вашому домені протягом ~4 годин».
- Skip option: «Залишити на піддомені поки що» (does not block publish).
- **Admin activation** (`/admin` tenant row): set `custom_domain` → writes
  `tenants.custom_domain` + `canonical_hostname = custom_domain`,
  `domain_status='active'`, purge cache tags for BOTH old and new host, regen sitemap
  implicitly via canonical change. DNS + registrar work stays manual ops.
- **Serving**: `getTenantByHost` (`lib/tenant/data.ts`) matches `host` OR
  `custom_domain` (suspension check unchanged). Middleware unchanged (already routes
  unknown hosts to tenant namespace). Invariant §2 (canonicalHostname = source of
  absolute URLs) preserved.

## 5. Analytics

- **Meta Pixel** `components/analytics/MetaPixel.tsx` (`next/script`,
  `NEXT_PUBLIC_META_PIXEL_ID`, renders nothing without env): mounted on PLATFORM pages
  only — landing, `/new` funnel, pay result. NEVER on tenant sites.
  Events: `PageView` (auto), `ViewContent` (preview iframe first shown),
  `InitiateCheckout` (checkout created), `Purchase` (result page, confirmed paid,
  `value: 999, currency: 'UAH'`, `eventID = order_reference`).
- **Internal funnel** — `funnel_events` written server-side at: `chat_start`,
  `draft_generated`, `preview_shown`, `publish_clicked`, `checkout_created`,
  `payment_success`, `domain_requested`. Helper `lib/analytics/funnel.ts`
  (`trackFunnel(kind, {tenantId?, conversationId?, meta?})`, best-effort, never throws).
- **Admin funnel card** on `/admin`: step counts + conversion %, 7/30 days.

## 6. Logging

- **`lib/log.ts`**, zero deps: `createLogger(module)` → `.info/.warn/.error(msg,
  fields?)`; dev = pretty single-line, prod = JSON single-line
  (`{ts, level, module, msg, ...fields}`).
- All NEW code uses it. Retrofit only critical money/publish paths:
  `lib/site/publish.ts`, `app/app/new/actions.ts`, webhook, checkout, domain actions.
  Other 40-ish `console.*` call sites stay (out of scope).

## 7. Landing + legal

- Landing hero: offer «Твій сайт за 999 грн» — сайт + домен на 1 рік; CTA to `/new`.
  Copy changes within existing `components/landing/**` structure, no redesign.
- Static pages `/oferta` (публічна оферта: what ₴999 buys — site + domain, 1 year,
  renewal terms, refund contact) and `/privacy`. FOP requisites as clearly marked
  placeholders — owner supplies before go-live (WayForPay merchant approval requires
  oferta + contacts on site).
- All user-facing copy Ukrainian.

## 8. Testing & verification

- **vitest** (new dev-dep, first test infra in repo, `npm test` script):
  `lib/payments/wayforpay` signature build/verify (official doc examples as fixtures),
  webhook idempotency transitions, paywall gate logic (`paid_until` comparisons),
  domain validation parsing. TDD for these pure modules.
- `npx tsc --noEmit`, `npm run build`, `npm run lint` green.
- Live Playwright walk on `lvh.me:3000`: onboard → preview → publish click → paywall
  screen → (test-merchant payment or `PAYWALL_DISABLED` path) → publish → domain step;
  screenshots. Edge case: webhook with broken signature → order stays pending.
- Smoke: one real WayForPay test-merchant purchase end-to-end.

## 9. Rollout checklist (owner)

1. Apply `0009_payments.sql` in Supabase SQL editor.
2. Prod env: WayForPay keys (test until merchant approved), `NEXT_PUBLIC_META_PIXEL_ID`,
   leave `PAYWALL_DISABLED` unset.
3. Register real WayForPay merchant (with partner) — needs oferta live.
4. FOP requisites → `/oferta`, `/privacy`.
5. Meta Pixel created in Ads Manager; campaign per `docs/idea-999-offer-test.md` §1
   ($20/day, 5–10 days, 3–4 creatives).
6. Domain ops runbook: TG notification → register at registrar → DNS → admin activate.

## Risks / notes

- Existing prod tenants grandfathered via backfill — verify count after migration.
- Auth degrades open without Supabase env (project pattern §3.1) — paywall still
  fail-closed independently (paid_until check does not depend on auth config).
- Parallel session owns `components/templates/**` — this work must not touch that zone
  (git status check before edits).
- WayForPay signature fields MUST be taken from current official docs at implementation
  time; test-merchant creds are public knowledge from WayForPay docs.
