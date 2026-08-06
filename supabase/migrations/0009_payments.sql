-- 0009_payments.sql — paid funnel («Твій сайт за 999 грн» demand test):
-- orders, tenant payment/domain state, internal funnel events.
-- Idempotent; safe to re-run. Run AFTER 0008_wireframe_only.sql.

-- One row per WayForPay checkout attempt. order_reference is the idempotency
-- key: the webhook may retry, the transition pending→paid happens once.
-- tenant_id is SET NULL on tenant delete, not cascade: financial records must
-- survive admin test-site cleanup (adminDeleteTestSite deletes tenants).
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references tenants(id) on delete set null,
  user_id         uuid,
  order_reference text not null unique,
  amount          numeric not null check (amount > 0),
  currency        text not null default 'UAH',
  status          text not null default 'pending'
                  check (status in ('pending','paid','declined','refunded','expired')),
  wfp_payload     jsonb,              -- last raw webhook payload (audit trail)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  paid_at         timestamptz
);
create index if not exists orders_tenant_idx on orders(tenant_id, created_at desc);
alter table orders enable row level security;

-- Payment state is orthogonal to lifecycle status: paid_until > now() = may publish.
alter table tenants add column if not exists paid_until timestamptz;
-- Custom domain serving + manual registration pipeline.
alter table tenants add column if not exists custom_domain text;
alter table tenants add column if not exists requested_domain text;
alter table tenants add column if not exists domain_status text not null default 'none';

do $$ begin
  alter table tenants add constraint tenants_custom_domain_key unique (custom_domain);
exception when duplicate_table then null; when duplicate_object then null; end $$;

do $$ begin
  alter table tenants add constraint tenants_domain_status_check
    check (domain_status in ('none','requested','active'));
exception when duplicate_object then null; end $$;

-- Platform funnel steps (landing→chat→draft→checkout→paid→domain). Distinct
-- from visitor-facing site_events on purpose: no kind CHECK — funnel steps
-- evolve with the offer, a migration per rename would be noise.
create table if not exists funnel_events (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null,
  tenant_id       uuid references tenants(id) on delete set null,
  conversation_id uuid,
  meta            jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists funnel_events_kind_time_idx on funnel_events(kind, created_at desc);
alter table funnel_events enable row level security;

-- 2026-08-06 semantics change: paid_until now means «may order a custom
-- domain» (publishing is FREE — the publish gate is gone). The original
-- grandfather backfill here (+10 years for already-published tenants) was
-- written for the publish gate; under the new meaning it would hand every
-- old tenant a free ₴999 domain. It is removed — and REVERTED where it
-- already ran: the 10-year horizon is the marker (no real payment grants
-- more than a year), and a tenant with an actually paid order keeps its
-- entitlement.
update tenants t set paid_until = null
  where t.paid_until > now() + interval '5 years'
    and not exists (
      select 1 from orders o where o.tenant_id = t.id and o.status = 'paid'
    );

notify pgrst, 'reload schema';
