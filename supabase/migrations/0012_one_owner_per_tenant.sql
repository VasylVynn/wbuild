-- 0012 — one owner per tenant (M1 claim gate, security review must-fix).
--
-- The app-side «insert → re-read → deterministic arbiter → loser deletes» dance
-- was NOT first-claim-wins: each racer arbitrates on its own READ COMMITTED
-- snapshot, which may not yet contain the other racer's uncommitted row, so two
-- users could both pass and both stay owners (the exact pre-M1 co-ownership
-- bug). The DB must arbitrate atomically: a partial unique index makes the
-- SECOND `role = 'owner'` insert for a tenant fail with 23505, which the claim
-- gate maps to the honest «привʼязаний до іншого акаунта» refusal.

-- Dedupe any co-owners the old race let through: keep the earliest owner per
-- tenant (created_at asc, user_id asc — the old arbiter's own ordering).
delete from tenant_members tm
where tm.role = 'owner'
  and (tm.tenant_id, tm.user_id) in (
    select tenant_id, user_id
    from (
      select tenant_id,
             user_id,
             row_number() over (
               partition by tenant_id
               order by created_at asc, user_id asc
             ) as rn
      from tenant_members
      where role = 'owner'
    ) ranked
    where ranked.rn > 1
  );

create unique index if not exists tenant_members_one_owner
  on tenant_members (tenant_id)
  where role = 'owner';
