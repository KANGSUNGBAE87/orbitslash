-- Orbit Slash ranking/backend readiness draft.
-- Review-only local draft. Do not apply remotely until Owner explicitly asks for Supabase setup/apply.

create table if not exists public.orbitslash_runs (
  id uuid primary key default gen_random_uuid(),
  run_token text not null unique,
  core_user_id uuid null,
  seed bigint not null,
  difficulty text not null,
  config_version text not null default 'local',
  ranking_strategy text not null default 'hybrid:supabase_verified+apps_in_toss_leaderboard_bridge',
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  status text not null default 'started',
  created_at timestamptz not null default now()
);

create table if not exists public.orbitslash_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.orbitslash_runs(id) on delete cascade,
  score integer not null check (score >= 0),
  survival_ms integer not null check (survival_ms >= 0),
  kills integer not null check (kills >= 0),
  max_combo integer not null check (max_combo >= 0),
  last_save_count integer not null check (last_save_count >= 0),
  remaining_energy integer not null check (remaining_energy between 0 and 100),
  skill_use jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.orbitslash_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  run_token text null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orbitslash_runs_token_idx
  on public.orbitslash_runs(run_token);

create index if not exists orbitslash_scores_score_idx
  on public.orbitslash_scores(score desc, survival_ms desc, created_at asc);

create index if not exists orbitslash_telemetry_events_name_created_idx
  on public.orbitslash_telemetry_events(event_name, created_at desc);

alter table public.orbitslash_runs enable row level security;
alter table public.orbitslash_scores enable row level security;
alter table public.orbitslash_telemetry_events enable row level security;

-- No public-open policies in this draft.
-- Expected production path:
-- 1. Client asks Edge/server endpoint to begin ranked run.
-- 2. Server creates run with service role after resolving internal core_user_id.
-- 3. Client submits summary to Edge/server endpoint.
-- 4. Server recomputes seed/config run and writes verified score.
-- 5. Raw Toss userKey or platform identifier is never stored in these tables.
