-- Bind public ranked boards to the server-issued weekly partition.
-- Apply through the approved Supabase migration path before enabling the public board.

alter table public.orbitslash_runs
  add column if not exists week_key text;

update public.orbitslash_runs
set week_key = coalesce(nullif(btrim(week_key), ''), 'legacy-ranked-week-unbound')
where week_key is null or btrim(week_key) = '';

alter table public.orbitslash_runs
  alter column week_key set not null;

create index if not exists orbitslash_runs_week_difficulty_id_idx
  on public.orbitslash_runs(week_key, difficulty, id);

create index if not exists orbitslash_scores_public_week_order_idx
  on public.orbitslash_scores(survival_ms desc, score desc, created_at asc)
  where verified and core_user_id is not null;

comment on column public.orbitslash_runs.week_key is
  'Server-issued Orbit Slash ranked week partition. Public leaderboard requests must filter by this key and difficulty.';
