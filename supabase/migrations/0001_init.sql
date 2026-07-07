-- 0001_init.sql — Vitryna MVP schema (idempotent; safe to re-run)
--
-- Load-bearing decision (brief §5.5, resolved via strategic review M2/M3):
--   * Page CONTENT is versioned at the PAGE level as jsonb block arrays
--     (draft_content / published_content). A normalized `blocks` row-table buys
--     nothing in MVP — PageSchema.parse validates the whole array anyway — and
--     it fights atomic publish + the switchTemplate "pocket" (§4.7 step 3).
--   * THEME is versioned at the TENANT level (draft_theme / published_theme),
--     NOT a single live column — otherwise an unpublished switchTemplate (which
--     changes the theme in draft, §4.7 step 6) would instantly restyle the LIVE
--     site.
--   * "Publish" promotes draft→published for the tenant theme AND every page's
--     content in ONE transaction, then purges the tenant cache tag (§9.1).
--
-- Public render reads published_* via the service key through the cache (§9);
-- RLS below guards the editor/dashboard plane only (§3.1).

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- tenants --------------------------------------------------------------------
create table if not exists tenants (
  id                 uuid primary key default gen_random_uuid(),
  -- Routing key. NULLable so a tenant can exist during agent-chat onboarding
  -- BEFORE its subdomain is chosen (keeps O1 open — see docs/data-model.md).
  -- Unique treats NULLs as distinct, so many in-onboarding tenants coexist.
  host               text unique,
  canonical_hostname text,                              -- §2.4 — source of all absolute URLs
  nav_mode           text not null default 'onepage'
                       check (nav_mode in ('onepage','multipage')),
  status             text not null default 'demo'
                       check (status in ('demo','draft','published','suspended')), -- §5.5 / kill-switch §11 / noindex §10.4
  brand              jsonb not null default '{}'::jsonb, -- {businessName, tagline?, logoUrl?}
  footer             jsonb not null default '{}'::jsonb, -- {phone?, address?, hours?, social?, copyright?}
  facts              jsonb not null default '{}'::jsonb, -- §4.4 grounding source + switchTemplate survival
  draft_theme        jsonb not null,                     -- §4.5 design tokens (editor writes here)
  published_theme    jsonb,                              -- promoted on publish; NULL until first publish
  vertical           text not null default 'florist',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- pages ----------------------------------------------------------------------
create table if not exists pages (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  slug               text not null,                      -- '' = home (§5.1.1); no leading/trailing slash
  page_type          text not null default 'home',
  title              text not null default '',
  show_in_nav        boolean not null default false,
  nav_order          integer not null default 0,
  -- {blocks: StoredBlock[], pocket: StoredBlock[]} — pocket holds blocks a
  -- switchTemplate dropped, retrievable, never deleted (§4.7 step 3).
  draft_content      jsonb not null default '{"blocks":[],"pocket":[]}'::jsonb,
  -- {blocks: StoredBlock[]} — what the public sees. NULL until first publish.
  published_content  jsonb,
  is_published       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, slug)                               -- §5.1.1 slug collision guard
);

-- conversations (agent-chat onboarding, §4.9) --------------------------------
create table if not exists conversations (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  messages           jsonb not null default '[]'::jsonb, -- transcript — INTERFACE only, not source of truth
  -- Slot-filling state = the current structured facts object (review S4). Resume
  -- after a closed tab reads THIS, never replays the transcript.
  facts_state        jsonb not null default '{}'::jsonb,
  is_complete        boolean not null default false,     -- required fields filled → ready to generate
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- tenant_members (auth ↔ tenant via membership, §3.1) ------------------------
create table if not exists tenant_members (
  tenant_id          uuid not null references tenants(id) on delete cascade,
  user_id            uuid not null,                      -- Supabase auth.users(id)
  role               text not null default 'owner' check (role in ('owner','editor')),
  created_at         timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index if not exists pages_tenant_idx on pages(tenant_id);
create index if not exists conversations_tenant_idx on conversations(tenant_id);
create index if not exists tenant_members_user_idx on tenant_members(user_id);

-- RLS: enabled now (review S3). Enabling with NO policy denies all anon/auth
-- access by default — the safe posture. Membership-based policies land with
-- Phase 3 auth. Public render bypasses RLS via the service key + cache (§9).
alter table tenants        enable row level security;
alter table pages          enable row level security;
alter table conversations  enable row level security;
alter table tenant_members enable row level security;

-- updated_at maintenance
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tenants_set_updated on tenants;
create trigger tenants_set_updated       before update on tenants       for each row execute function set_updated_at();
drop trigger if exists pages_set_updated on pages;
create trigger pages_set_updated         before update on pages         for each row execute function set_updated_at();
drop trigger if exists conversations_set_updated on conversations;
create trigger conversations_set_updated before update on conversations for each row execute function set_updated_at();

-- Force PostgREST to reload its schema cache so the new tables are queryable
-- immediately via the API (fixes PGRST205 "not found in schema cache").
notify pgrst, 'reload schema';
