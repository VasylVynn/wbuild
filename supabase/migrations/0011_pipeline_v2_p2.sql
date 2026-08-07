-- 0011_pipeline_v2_p2.sql — Pipeline v2 (spec 2026-08-07) part 2:
-- contentRev backfill (§9) and the generation progress store (§7).
-- Idempotent; safe to re-run. Applied MANUALLY in the Supabase SQL editor
-- (no DATABASE_URL / migrate script). Run AFTER 0010_pipeline_v2_p1.sql.
--
-- The §0 clean-slate cleanup of test tenants is NOT here: it is a one-shot
-- destructive script (supabase/scripts/2026-08-07-cleanup-test-tenants.sql),
-- deliberately kept out of the migration chain. Its original predicate
-- (`paid_until is null`) would have deleted essentially EVERY tenant: since
-- the 2026-08-06 semantics change (0009), paid_until only means «may order a
-- custom domain» — publishing is free, so live real customers have NULL too.

-- §9 contentRev backfill: every async DRAFT writer now compare-and-swaps on
-- coalesce((draft_content->>'contentRev')::int, 0). The coalesce in the code
-- already accepts NULL-as-0 on pre-v2 rows, so this backfill is belt, not
-- correctness — but an explicit 0 makes the CAS filters uniform and the rows
-- self-describing. Published copies deliberately NOT touched: contentRev is
-- DRAFT_ONLY (publishedFromDraft strips it).
update pages
   set draft_content = jsonb_set(draft_content, '{contentRev}', '0'::jsonb, true)
 where draft_content is not null
   and jsonb_typeof(draft_content) = 'object'
   and draft_content->'contentRev' is null;

-- §7 progress store: one row per host, overwritten at every stage boundary by
-- the /api/generate transport (the pipeline itself only emits onStage events —
-- the transport owns reads AND writes here). Exists for M12 rehydration:
-- cross-host chat handoff means the document that started a generation may not
-- be the one watching it, so stage cards re-mount from this row; it doubles as
-- the polling fallback when SSE is unavailable. Service-role access only
-- (RLS on, no policies), same posture as the other internal tables.
create table if not exists generation_progress (
  host       text primary key,
  stage      text not null,
  status     text not null,
  detail     jsonb,
  updated_at timestamptz not null default now()
);
alter table generation_progress enable row level security;

notify pgrst, 'reload schema';
