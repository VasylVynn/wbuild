# Analytics Design — 3minsite

- **Date:** 2026-07-23
- **Status:** DRAFT — design agreed at high level; 3 open decisions pending (see bottom).
- **Scope:** Analytics for **two audiences** — the platform (us) and the tenant/site owner (client).
- **Shape:** A program of 4 independent sub-specs, built sequentially. Each sub-spec gets its own plan → implementation cycle.

---

## 1. Problem

We have no useful analytics. The event-collection foundation partially exists but is fragmented and half-dead. The two most valuable things the master plan promises — a **Telegram monthly report for clients** (the documented "retention engine") and a **platform funnel for us** — are not built. This design turns the raw pipeline into something that (a) exists and (b) is actually useful for each audience.

## 2. Current state (inventory, 2026-07-23)

**FOR US (platform) — `/admin`, founders only:**
- KPI cards: Sites, Published, Leads (total), Draftless conversations, Total conversations.
- Per-site lead counts computed by **row-scan** of up to 5000 lead rows (`admin/page.tsx`), not aggregated SQL.
- Custom-change requests pushed to our Telegram (`ADMIN_TELEGRAM_CHAT_ID`).
- ⚠️ `/admin` **does not read `site_events` at all**.

**FOR CLIENT (tenant owner) — dashboard `app.`:**
- 3 cards: **Переглядів за 7 днів**, **Заявок за 7 днів**, Sites + 5 freshest leads (`app/app/page.tsx`, `components/dashboard/DashboardHome.tsx`).
- `/leads` — list of leads (≤200). `/sites` — status label only, no metrics.
- That is the entire client analytics surface: two 7-day counters.

**Event pipeline reality:**
- Tenant sites fire `Beacon` → `sendBeacon("/api/events")`: `view`, `tel_click`, `contact_click` (`components/site/Beacon.tsx`).
- `/api/events` persists to `site_events` ✅ (`app/api/events/route.ts`).
- Only `kind=view` (7-day) is ever read (dashboard + editor-chat context). **`tel_click`/`contact_click` are stored but never read — dead data.**
- Onboarding, dashboard, and the lead form have **no instrumentation**. Lead submission is not logged as an event.

**Schema (confirmed):**
```sql
site_events(id uuid, tenant_id uuid, kind text CHECK (view|tel_click|contact_click),
            path text, created_at timestamptz)
index site_events_tenant_time_idx (tenant_id, created_at desc)
-- No referrer, no session/visitor id (privacy: no IP by design).
tenants.telegram_chat_id text   -- bound via /start deep-link; reused for the report
```
- **No cron mechanism exists** (no `vercel.json`, no cron routes) — must be established.
- Telegram send primitive: `sendTelegramMessage(chatId, text)` in `lib/telegram/push.ts` (HTML parse mode).

## 3. What the master plan says

- Analytics deliberately deferred from MVP (v2.2, `architecture-brief.md`).
- Event counters shipped **specifically to feed a future monthly report** — "живлять місячний звіт етапу 2" (`mvp-build-plan.md`).
- **Telegram monthly report = retention engine:** "X переглядів, Y заявок + AI-рекомендації". Partner: *"Звіт у Telegram (не дашборд — «пекарка в аналітику не заходить»)"* → **planned, no code**.
- **Platform funnel** (CTA→chat→login→generation→publish), "мінімум PostHog free" → **not done**.
- Competitor (Roxybo) uses PostHog + FB Pixel + GTM.

## 4. Decisions (from brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Priority / scope | **Both audiences, sequenced** (a program of sub-specs) |
| D2 | Data foundation | **Hybrid** — client/tenant analytics stays self-hosted on `site_events`; **platform funnel on PostHog free** (our pages only) |
| D3 | Telegram report v1 ambition | **Numbers + one AI recommendation** (1 AI call / tenant / period) |
| D4 | Report cadence | **Monthly** |

## 5. Invariants respected (CLAUDE.md)

- **No foreign scripts on tenant sites** → PostHog only on platform pages; the `/s/[host]` render namespace is excluded.
- **Privacy** → no IP / fingerprint; at most `referrer_host` (not PII).
- **Middleware never queries Postgres** → analytics reads live in server components / route handlers only.
- **Publish is human-only** → the report is read-only; it never writes draft/published.
- **Facts grounding** → the AI recommendation must not invent business facts; it is grounded only on the metrics + existing blocks. Generic marketing advice only.
- **`canonicalHostname`** is the source of any absolute URL in the report.

---

## 6. Sub-specs

### Sub-spec A — Event foundation (shared; build first among the client-side chain)

**Problem:** data exists but is fragmented and half-dead.

- **`lib/analytics/` — single aggregation module.** One function `getTenantMetrics(tenantId, {from, to})` → `{views, leads, telClicks, contactClicks, bySource?}` + previous-period figures for trend. Reads `site_events` (views/clicks) **joined** with `leads` (submissions — `leads` stays the source of truth; not duplicated into `site_events`). Replaces the two hand-rolled 7-day view queries in the dashboard and editor-chat.
- **Revive dead data:** `tel_click`/`contact_click` are already collected but never read — the module reads them.
- **(Recommended) `referrer_host`:** new column on `site_events` + one line in `Beacon.tsx` (referrer host only, privacy-safe). Unlocks "traffic sources" (Instagram / Google / Telegram) for both the report and the dashboard. This is the **only optional element** — everything else works without it.
- Migration `0007_analytics.sql` (idempotent; applied manually in Supabase SQL editor per repo convention).

### Sub-spec B — Platform funnel for US (PostHog free)

- PostHog (cloud free) **on our pages only**: landing → onboarding → auth → dashboard/editor. **Never** reaches tenant sites.
- Capture funnel: `landing_cta_click → onboard_started → onboard_completed(site generated) → signup → publish_clicked`. Attach points: existing onboard SSE, auth, publish action.
- PostHog provides funnel / retention / sessions out of the box — **zero dashboard code on our side**.
- Gated behind env `NEXT_PUBLIC_POSTHOG_KEY` (no key → no-op, consistent with the repo's fail-open integrations).
- **Outcome:** we can finally answer "what % of onboardings reach publish" and where users drop off.

### Sub-spec C — Monthly Telegram report for the client (retention flagship; depends on A)

- **Trigger:** secured route `/api/cron/monthly-report` (guard `CRON_SECRET`), on the 1st of the month. Mechanism: Vercel Cron (`vercel.json`) or an external scheduler — hosting to confirm in planning.
- For each `status=published` tenant with a `telegram_chat_id`: compute last-month metrics + previous month (trend), generate **1 AI recommendation** (Anthropic tool-use, Ukrainian), format HTML, send via `sendTelegramMessage()`.
- **Message body (Ukrainian):** views (▲ trend), leads, phone clicks, view→lead conversion, traffic source, and **💡 one concrete recommendation** + a "Редагувати сайт" button.
- **Depressing-zeros guard:** if 0 views, send an activation nudge ("поділіться посиланням в Instagram") instead of "3 перегляди".
- **Idempotency:** table `report_log(tenant_id, period, sent_at)` so cron retries don't double-send.
- **Fallback:** if the AI call fails, a deterministic rule-based tip. Best-effort, like the lead push.

### Sub-spec D — Client dashboard upgrade (optional; depends on A)

- Partner says owners don't visit the dashboard → **lower priority**, but cheap once A exists.
- Extend the 3 cards: 30-day window, phone/contact clicks, conversion rate, a sparkline, traffic sources. Reuses `lib/analytics`.

---

## 7. Sequencing & dependencies

```
A (foundation) ──┬──> C (Telegram report)   ← primary retention value
                 └──> D (dashboard, optional)
B (PostHog funnel) — independent; can run first/in parallel (fastest win for us)
```

**Recommended order:** **B** (half a day → funnel for us) → **A** → **C** → **D**.

## 8. Success criteria

- **For us:** a live PostHog funnel CTA→publish within days; we can answer where onboarding drops off.
- **For the client:** a real monthly Telegram report lands for a test tenant with correct numbers + a sensible Ukrainian recommendation; the dead `tel_click`/`contact_click` data is finally surfaced.

---

## 9. Open decisions (pending user confirmation)

1. **Order B→A→C→D** (PostHog funnel first, fastest payoff for us) — or start with client-facing C?
2. **`referrer_host`** (traffic sources) — include in the foundation, or defer?
3. **PostHog cloud free** for us — OK, or any concern about a third-party service even on our own pages?

## 10. Next step

On approval + answers to §9: write per-sub-spec implementation plans (writing-plans), starting with the agreed first sub-spec.
