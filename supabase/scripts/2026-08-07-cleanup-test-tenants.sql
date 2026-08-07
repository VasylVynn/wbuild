-- ONE-SHOT destructive cleanup — NOT a migration. Never re-run after
-- 2026-08-07; never run without reviewing the SELECT preview first.
--
-- §0 clean-slate cleanup (owner decision 2026-08-07: existing tenants at that
-- date were test data, there were no real users). This file was split OUT of
-- 0011_pipeline_v2_p2.sql (review must-fix): the original predicate
-- (`paid_until is null`) matched essentially every tenant — since the
-- 2026-08-06 semantics change (0009), paid_until only means «may order a
-- custom domain», publishing is free, so live real customers carry NULL too.
-- A destructive statement also must never share a file with DDL the product
-- depends on (generation_progress), where "apply the migration" re-runs it.
--
-- Scope: draft-only tenants created BEFORE the cutoff that hold no payment
-- entitlement AND have never received a lead (leads are the product's core
-- value — a tenant with leads is a customer, not a fixture).
-- pages/leads/conversations/tenant_members/site_events cascade with the tenant
-- (0001/0002/0005/0006/0007); orders/funnel_events keep their rows with
-- tenant_id SET NULL (0009: financial records survive cleanup).

-- 1) PREVIEW — run alone, eyeball every host before deleting:
-- select host, status, created_at from tenants t
--  where t.paid_until is null
--    and t.status = 'draft'
--    and t.created_at < timestamptz '2026-08-07 00:00+00'
--    and not exists (select 1 from leads l where l.tenant_id = t.id)
--  order by created_at;

-- 2) DELETE — the one-shot itself:
delete from tenants t
 where t.paid_until is null
   and t.status = 'draft'
   and t.created_at < timestamptz '2026-08-07 00:00+00'
   and not exists (select 1 from leads l where l.tenant_id = t.id);
