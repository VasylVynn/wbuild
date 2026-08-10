-- 0013 — ig_snapshots.tenant_id backfill (live audit 2026-08-10, owner's #1).
-- Idempotent; safe to re-run. Run AFTER 0012_one_owner_per_tenant.sql.
-- APPLIED MANUALLY in the Supabase SQL editor (repo convention — no migrate script).
--
-- 0007 declared that a snapshot «starts life on a conversation and is promoted to
-- the published tenant», but nothing ever performed the promotion: every row in
-- production carried tenant_id = NULL. Consequence — any reader keyed BY TENANT
-- (editor regeneration, the tenant dossier, provenance/audit surfaces) found
-- nothing, so an owner could not tell whether the generated copy came from the
-- real Instagram profile or was invented. The app now links at generate time
-- (lib/onboard/generate-flow.ts) and stamps at insert when a real tenant already
-- exists (lib/ig/deep.ts); this migration repairs the rows written before that.
--
-- SAFETY:
--   * `s.tenant_id is null` — never re-points a snapshot that already has an
--     owner, so re-running is a no-op and a conversation reused across two sites
--     cannot steal the first site's provenance.
--   * `t.host is not null` — a conversation whose only tenant is the pre-generation
--     ANCHOR placeholder (host null, status demo, created by startConversation) is
--     skipped. Stamping the anchor id would be worse than NULL: the app refuses to
--     overwrite a non-null tenant_id, so the row could never be promoted to the
--     real tenant afterwards. Such rows stay NULL and remain reachable through the
--     reader-side conversation fan-out until their site is generated.
--   * A conversation with no tenant at all simply doesn't join — nothing happens.
update ig_snapshots s
set tenant_id = c.tenant_id
from conversations c
join tenants t on t.id = c.tenant_id
where s.conversation_id = c.id
  and s.tenant_id is null
  and t.host is not null;

-- The reader fans a tenant out to its conversations before probing snapshots;
-- conversations_tenant_idx (0001) already serves that lookup, and
-- ig_snapshots_{tenant,conversation}_idx (0007) serve both newest-first probes.
-- Nothing new is needed here — stated so the next reader doesn't re-derive it.

notify pgrst, 'reload schema';
