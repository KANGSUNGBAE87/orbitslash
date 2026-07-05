create table if not exists public.orbitslash_gameplay_events (
  id bigserial primary key,
  client_event_id text not null unique,
  session_trace_id text not null,
  run_token text,
  core_user_id uuid,
  event_name text not null,
  mode_id text,
  difficulty text,
  screen text not null,
  runtime text not null,
  runtime_channel text,
  enemy_type text,
  skill_id text,
  reason text,
  band text,
  score integer,
  survival_ms integer,
  combo integer,
  event_sequence integer not null,
  client_at timestamptz not null,
  app_version text,
  build_version text,
  deployment_id text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint orbitslash_gameplay_events_runtime_check
    check (runtime in ('web_stub', 'apps_in_toss', 'google_play')),
  constraint orbitslash_gameplay_events_runtime_channel_check
    check (runtime_channel is null or runtime_channel in ('sandbox', 'toss_private_test', 'toss_live')),
  constraint orbitslash_gameplay_events_event_sequence_check
    check (event_sequence > 0),
  constraint orbitslash_gameplay_events_score_check
    check (score is null or score >= 0),
  constraint orbitslash_gameplay_events_survival_ms_check
    check (survival_ms is null or survival_ms >= 0),
  constraint orbitslash_gameplay_events_combo_check
    check (combo is null or combo >= 0)
);

alter table public.orbitslash_gameplay_events enable row level security;
revoke all on table public.orbitslash_gameplay_events from anon, authenticated;

create index if not exists orbitslash_gameplay_events_session_idx
  on public.orbitslash_gameplay_events (session_trace_id, client_at desc);

create index if not exists orbitslash_gameplay_events_event_idx
  on public.orbitslash_gameplay_events (event_name, client_at desc);

create index if not exists orbitslash_gameplay_events_mode_idx
  on public.orbitslash_gameplay_events (mode_id, difficulty, client_at desc);

comment on table public.orbitslash_gameplay_events is
  'Orbit Slash gameplay telemetry sink. Insert only through service-role Edge Function; do not store raw Toss userKey or device identifiers.';
