-- Orbit Slash ranked rejection diagnostics draft.
-- Remote apply is intentionally separate from local implementation.

alter table public.orbitslash_runs
  add column if not exists rejection_reason text null,
  add column if not exists rejected_at timestamptz null;

create index if not exists orbitslash_runs_rejected_at_idx
  on public.orbitslash_runs(rejected_at desc)
  where status = 'rejected';

comment on column public.orbitslash_runs.rejection_reason is
  'Machine-readable ranked submission rejection reason. Do not store replay payloads, raw identity, or provider ids here.';

comment on column public.orbitslash_runs.rejected_at is
  'Timestamp when the ranked Edge verifier marked a run as rejected.';
