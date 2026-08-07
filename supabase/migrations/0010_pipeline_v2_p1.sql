-- 0010_pipeline_v2_p1.sql — Pipeline v2 (spec 2026-08-07) part 1: atomic
-- design-nonce bump (spec §4).
-- Idempotent; safe to re-run. Applied MANUALLY in the Supabase SQL editor
-- (no DATABASE_URL / migrate script). Run AFTER 0009_payments.sql.

-- Atomic «advance the design nonce, return the new value» — rl_bump precedent
-- (0003). The old read-modify-write in generateDraft spanned the ~2-minute
-- model chain: two parallel generations of one host read the same nonce and
-- produced identical seeds on EVERY axis (hue, hero variant, font, motion,
-- direction). A single UPDATE takes the row lock, so concurrent callers
-- serialize and each generation gets its own nonce BEFORE any model call.
--
-- Semantics mirror the TypeScript fallback (lib/design/seed.ts) exactly:
-- JSON number → floor(n)+1; absent / non-number (a JSON string like "9" is
-- garbage there too) → 0; no tenant row → 0 (first generation of a fresh
-- host; its own upsert persists nonce 0 moments later). Gate on jsonb_typeof,
-- NOT a text regex over ->> — the regex accepted string-typed digits the TS
-- side rejects and reset the counter for a fractional number (review must-fix).
create or replace function design_nonce_bump(tenant_host text)
returns integer
language plpgsql
as $$
declare
  v_nonce integer;
begin
  update tenants
     set brand = jsonb_set(
           coalesce(brand, '{}'::jsonb),
           '{designNonce}',
           to_jsonb(
             case
               when jsonb_typeof(brand->'designNonce') = 'number'
                 then floor((brand->>'designNonce')::numeric)::integer + 1
               else 0
             end
           ),
           true
         )
   where host = tenant_host
  returning (brand->>'designNonce')::integer into v_nonce;

  return coalesce(v_nonce, 0);
end;
$$;

notify pgrst, 'reload schema';
