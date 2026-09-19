create table if not exists public.orbitslash_product_events (
  id bigserial primary key,
  client_event_id text not null unique,
  session_trace_id text not null,
  core_user_id uuid,
  event_name text not null,
  event_sequence integer not null check (event_sequence > 0),
  runtime text not null check (runtime in ('web_stub', 'apps_in_toss', 'google_play')),
  runtime_channel text check (runtime_channel is null or runtime_channel in ('sandbox', 'toss_private_test', 'toss_live')),
  deployment_id text,
  client_at timestamptz not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.orbitslash_product_events enable row level security;
revoke all on table public.orbitslash_product_events from anon, authenticated;

create index if not exists orbitslash_product_events_name_at_idx
  on public.orbitslash_product_events (event_name, client_at desc);
create index if not exists orbitslash_product_events_trace_idx
  on public.orbitslash_product_events (session_trace_id, event_sequence);

comment on table public.orbitslash_product_events is
  'Orbit Slash privacy-safe product funnel telemetry. Edge Function service-role writes only; no raw provider or device identifiers.';
