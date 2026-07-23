-- 0007_ig_snapshots.sql — Instagram scrape persistence (refactor 03 §1.1)
-- Idempotent; safe to re-run. Run AFTER 0006_editor_chats.sql.

-- One row per deep scrape. The scrape route/tool writes this server-side — the
-- old ig-import flow streamed everything to the client as the ONLY copy and
-- persisted nothing. Multiple rows per conversation/tenant are expected (a
-- re-scrape is a new row); the dossier reads the latest by scraped_at.
--   raw    = the scrape sources (profile preview + posts) kept for re-processing.
--   parsed = our normalized, merged IgParsedProfile (the dossier reads this).
-- Both links are nullable and re-linked at finalize, like conversations: a scrape
-- starts life on a conversation and is promoted to the published tenant.
create table if not exists ig_snapshots (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  tenant_id       uuid references tenants(id) on delete cascade,
  handle          text not null,
  raw             jsonb not null,
  parsed          jsonb not null,
  scraped_at      timestamptz not null default now()
);
alter table ig_snapshots enable row level security;

-- Latest-wins lookups by either scope.
create index if not exists ig_snapshots_conversation_idx
  on ig_snapshots (conversation_id, scraped_at desc);
create index if not exists ig_snapshots_tenant_idx
  on ig_snapshots (tenant_id, scraped_at desc);

notify pgrst, 'reload schema';
