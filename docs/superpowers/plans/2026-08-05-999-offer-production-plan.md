# Plan: «Твій сайт за 999 грн» — production build

Spec: `docs/superpowers/specs/2026-08-05-999-offer-production-design.md` (approved).
Execution: team-lead session + parallel opus agents in waves. File ownership is strict —
no two wave-1 agents touch the same file.

## Wave 0 — foundation (team lead, direct)

- `supabase/migrations/0009_payments.sql` — orders, tenants payment/domain columns,
  funnel_events, grandfather backfill.
- `lib/log.ts` — zero-dep structured logger (`createLogger(module)`).
- `lib/analytics/funnel.ts` — `trackFunnel(kind, ids)` server-side, best-effort.
- `lib/analytics/pixel.tsx` — `MetaPixel` component (next/script, env-gated) +
  `pixelTrack(event, params?, eventId?)` client helper.
- `lib/rate-limit.ts` — add limiters: `checkout`, `order_status`, `domain_check`, `publish`.
- `.env.example` — WayForPay block, `PRICE_UAH`, `PAYWALL_DISABLED`, `NEXT_PUBLIC_META_PIXEL_ID`.

## Wave 1 — parallel opus agents (independent file sets)

### Agent P1 — payments-core
Files (all new): `lib/payments/wayforpay.ts`, `app/api/payments/wayforpay/route.ts`,
`app/app/pay/actions.ts`, `app/app/pay/result/page.tsx` (+ client component),
`vitest.config.ts`, `package.json` (test script + vitest devDep), tests under
`lib/payments/wayforpay.test.ts`.
Contract exposed:
- `createCheckoutAction(host): {ok:true, checkout:{action:string, fields:Record<string,string>}} | {ok:false, error}`
- `getOrderStatusAction(orderReference): {ok:true, status: OrderStatus} | {ok:false, error}`
Must fetch current official WayForPay Purchase + serviceUrl docs (signature field order)
— no memory-based signatures. Fail-closed. Uses `lib/log`, `trackFunnel('checkout_created'|'payment_success')`, `pixelTrack('Purchase')` on result page.

### Agent P3 — domains
Files: `lib/domains/rdap.ts` (new), `app/app/new/domain-actions.ts` (new),
`lib/tenant/data.ts` (host OR custom_domain lookup), admin activation:
`app/app/(protected)/(shell)/admin/actions.ts` (add action) + new self-contained
component `app/app/(protected)/(shell)/admin/DomainActivation.tsx` (NOT mounted yet —
wave 2 mounts it).
Contract exposed:
- `checkDomainAction(domain): {ok:true, available: boolean|null} | {ok:false, error}`
- `requestDomainAction(host, domain): {ok:true} | {ok:false, error}` (sets requested_domain,
  domain_status='requested', TG push, trackFunnel('domain_requested'))
- `adminActivateDomainAction(host, customDomain)` — sets custom_domain + canonical_hostname,
  domain_status='active', purges BOTH host tags.

### Agent P4 — landing + legal + admin funnel card
Files: `app/page.tsx` (hero offer copy + MetaPixel mount), `components/landing/**` copy
only, `app/oferta/page.tsx`, `app/privacy/page.tsx` (new), `app/app/new/page.tsx`
(MetaPixel mount only), admin funnel: `app/app/(protected)/(shell)/admin/funnel-actions.ts`
+ `FunnelCard.tsx` (self-contained, NOT mounted — wave 2 mounts).
Ukrainian copy. FOP requisites = marked placeholders.

## Wave 2 — integrator (single opus agent, hot shared files)

Files: `lib/site/publish.ts` (paywall gate + `bypassPaywall` opt + logging retrofit),
`app/app/new/actions.ts` (payment_required contract, funnel instrumentation, logging),
`app/app/(protected)/edit/actions.ts` (publishSite: `publish` rate limit + contract),
`components/onboard/OnboardChat.tsx` (payment screen → checkout → poll → auto-retry
finalize → domain step UI), `components/editor/EditorShell.tsx` (paywall modal),
`app/app/(protected)/(shell)/admin/generate/actions.ts` + `app/api/dev/generate/route.ts`
(bypassPaywall), admin page.tsx (mount DomainActivation + FunnelCard),
`pixelTrack('ViewContent'|'InitiateCheckout')` wiring.
MUST NOT touch `components/templates/**` (parallel human session owns it).

## Wave 3 — verify & review (team lead + agents)

1. `npx tsc --noEmit`, `npm run build`, `npm test`, `npm run lint`.
2. Reviewer agents: security/correctness pass on payment path; general code review on
   the rest. Apply must-fixes.
3. Live Playwright: onboard → preview → publish → paywall → (PAYWALL_DISABLED or test
   merchant) → publish → domain step; screenshots. Edge: bad webhook signature.
4. Commit in logical units (only files this session touched).

## Env contract (final)

```
WAYFORPAY_MERCHANT_ACCOUNT=   # test merchant until real one approved
WAYFORPAY_MERCHANT_SECRET=
WAYFORPAY_MERCHANT_DOMAIN=    # e.g. wizz-app.net
PRICE_UAH=999
PAYWALL_DISABLED=             # 1 only in local dev
NEXT_PUBLIC_META_PIXEL_ID=
```
