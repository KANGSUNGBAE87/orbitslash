-- Orbit Slash ranking hardening.
-- Keeps public clients away from ranking tables until Edge/server verification exists.

create unique index if not exists orbitslash_scores_run_id_uidx
  on public.orbitslash_scores(run_id);

revoke all on table public.orbitslash_runs from anon, authenticated;
revoke all on table public.orbitslash_scores from anon, authenticated;
revoke all on table public.orbitslash_telemetry_events from anon, authenticated;
