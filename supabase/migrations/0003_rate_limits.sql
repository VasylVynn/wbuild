-- 0003_rate_limits.sql — anti-abuse rate limiting (brief §11, build-plan O2)
-- Idempotent; safe to re-run. Run AFTER 0002_leads.sql.

-- Fixed-window counters shared across serverless instances. Keys look like
-- '<limit_name>:<client_ip>'. Rows are short-lived: rl_bump() opportunistically
-- deletes a key's expired windows on every call, so no cron is needed.
create table if not exists rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  expires_at    timestamptz not null,
  primary key (key, window_start)
);
alter table rate_limits enable row level security; -- service key only

-- Atomic "count this hit, return the new total for the current window".
-- One round-trip per checked request; the app compares the result to its
-- env-configured ceiling (storage knows nothing about limits — retuning
-- thresholds never touches the DB).
create or replace function rl_bump(
  p_key text,
  p_window_start timestamptz,
  p_expires_at timestamptz
) returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into rate_limits (key, window_start, count, expires_at)
  values (p_key, p_window_start, 1, p_expires_at)
  on conflict (key, window_start)
    do update set count = rate_limits.count + 1
  returning count into v_count;

  -- Opportunistic cleanup: a key has at most a handful of live windows, so
  -- this stays cheap via the primary-key index.
  delete from rate_limits where key = p_key and expires_at < now();

  return v_count;
end;
$$;

notify pgrst, 'reload schema';
