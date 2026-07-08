-- 0004_auth_claim.sql — email/password auth ownership (brief §3.1)
-- Idempotent; safe to re-run. Run AFTER 0003_rate_limits.sql.

-- Anonymous onboarding creates a tenant with no owner. When the creator isn't
-- logged in we stamp a one-time claim_token (same pattern as
-- telegram_connect_token, §5.6) and hand it to the browser; after they register
-- claimSitesAction binds membership and nulls the token.
alter table tenants add column if not exists claim_token text unique;

-- Groundwork RLS: let an authenticated user read their OWN membership rows.
-- Server flows still run through the service key (which bypasses RLS); this
-- policy exists so a future direct-from-client read is safe by default.
drop policy if exists tenant_members_self_select on tenant_members;
create policy tenant_members_self_select on tenant_members
  for select to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
