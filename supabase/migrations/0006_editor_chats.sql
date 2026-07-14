-- 0006_editor_chats.sql — agentic editor chat (redesign plan P3)
-- Idempotent; safe to re-run. Run AFTER 0005_events_requests.sql.

-- One row per tenant: the running editor-agent conversation. Messages are the
-- UI-level transcript (user/assistant + tool summaries); the agent loads them
-- as memory on every turn, together with the onboarding conversation that
-- finalizeAction now re-links to the published tenant.
create table if not exists editor_chats (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null unique references tenants(id) on delete cascade,
  messages   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table editor_chats enable row level security;

notify pgrst, 'reload schema';
