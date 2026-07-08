-- 0005_events_requests.sql — analytics counters + custom-work requests
-- Idempotent; safe to re-run. Run AFTER 0004_auth_claim.sql.

-- Minimal event counters (build-plan «Поточний цикл» п.2 → живлять місячний
-- звіт етапу 2). PRIVACY: no IP, no fingerprint — tenant, kind, path, time.
create table if not exists site_events (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  kind       text not null check (kind in ('view','tel_click','contact_click')),
  path       text not null default '/',
  created_at timestamptz not null default now()
);
create index if not exists site_events_tenant_time_idx on site_events(tenant_id, created_at desc);
alter table site_events enable row level security;

-- «Хочу кастомні зміни» — заявки власників ДО НАС (апсел-канал, етап-2 дискусія
-- з партнером). Пуш у ADMIN_TELEGRAM_CHAT_ID — best-effort.
create table if not exists custom_requests (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  message    text not null,
  contact    text,               -- owner's phone/email from facts (prefilled)
  pushed_at  timestamptz,        -- admin Telegram push succeeded
  created_at timestamptz not null default now()
);
create index if not exists custom_requests_time_idx on custom_requests(created_at desc);
alter table custom_requests enable row level security;

notify pgrst, 'reload schema';
