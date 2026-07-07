-- 0002_leads.sql — lead funnel (brief §5.6; owner decision 2026-07-07: back in MVP)
-- Idempotent; safe to re-run. Run AFTER 0001_init.sql.

-- Leads submitted from tenant sites. Stored even when the owner hasn't
-- connected Telegram yet (push is best-effort; pushed_at stays NULL).
create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text,
  phone       text,
  message     text,
  source      text not null default 'lead_form',   -- future: 'booking_request'
  meta        jsonb not null default '{}'::jsonb,  -- {slug, ua} — no raw IP (privacy)
  pushed_at   timestamptz,                          -- set when Telegram push succeeded
  created_at  timestamptz not null default now()
);
create index if not exists leads_tenant_idx on leads(tenant_id, created_at desc);
alter table leads enable row level security; -- service key writes; owner reads later via membership

-- Telegram wiring on tenants (§5.6): one central platform bot; the owner's
-- chat_id is captured via the /start deep-link with a per-tenant token.
alter table tenants add column if not exists telegram_chat_id text;
alter table tenants add column if not exists telegram_connect_token text unique;

notify pgrst, 'reload schema';
