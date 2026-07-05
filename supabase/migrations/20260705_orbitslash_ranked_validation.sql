-- Orbit Slash public ranked validation contract.
-- Local draft only until Owner explicitly asks to apply/deploy Supabase changes.

alter table public.orbitslash_runs
  add column if not exists expires_at timestamptz null,
  add column if not exists used_at timestamptz null,
  add column if not exists validation_version text not null default 'ranked-v1';

alter table public.orbitslash_scores
  add column if not exists core_user_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orbitslash_runs_status_check'
      and conrelid = 'public.orbitslash_runs'::regclass
  ) then
    alter table public.orbitslash_runs
      add constraint orbitslash_runs_status_check
      check (status in ('started', 'submitted', 'expired', 'rejected'));
  end if;
end $$;

create index if not exists orbitslash_runs_expires_idx
  on public.orbitslash_runs(expires_at);

create index if not exists orbitslash_runs_status_created_idx
  on public.orbitslash_runs(status, created_at desc);

create index if not exists orbitslash_scores_core_user_survival_idx
  on public.orbitslash_scores(core_user_id, survival_ms desc, score desc, created_at desc)
  where core_user_id is not null;

comment on table public.orbitslash_runs is
  'Orbit Slash ranked run tokens. Public clients must use Edge/server verification; direct table access stays revoked.';

comment on column public.orbitslash_runs.expires_at is
  'Server-issued ranked run expiry. Submissions after this timestamp are rejected.';

comment on column public.orbitslash_runs.used_at is
  'Set once when a ranked score is accepted. Prevents token reuse.';

comment on column public.orbitslash_runs.validation_version is
  'Server validation contract version used by the Edge function.';

comment on column public.orbitslash_scores.core_user_id is
  'Internal user identity copied from the verified ranked run. Null scores must not be shown on public leaderboards.';
