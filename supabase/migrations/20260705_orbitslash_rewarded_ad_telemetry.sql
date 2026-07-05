-- Orbit Slash rewarded-ad telemetry draft.
-- Local draft only until Owner explicitly asks to apply/deploy Supabase changes.

create table if not exists public.orbitslash_rewarded_ad_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id text not null unique,
  session_trace_id text not null,
  run_token text null,
  core_user_id uuid null,
  ad_format text not null default 'rewarded' check (ad_format = 'rewarded'),
  placement text not null check (
    placement in (
      'free_defense_revive',
      'free_defense_extra_play',
      'story_retry',
      'ranked_retry_ticket',
      'boss_rush_retry'
    )
  ),
  event_name text not null check (
    event_name in (
      'preload_started',
      'loaded',
      'show_requested',
      'shown',
      'impression',
      'user_earned_reward',
      'dismissed',
      'failed'
    )
  ),
  screen text not null,
  mode_id text null,
  runtime text not null check (runtime in ('web_stub', 'apps_in_toss', 'google_play')),
  runtime_channel text null check (runtime_channel in ('sandbox', 'toss_private_test', 'toss_live')),
  sdk_event_type text null,
  placement_key text null,
  placement_id text null,
  ad_group_id text null,
  reason text null,
  shown boolean not null default false,
  reward_earned boolean not null default false,
  dismissed boolean not null default false,
  event_sequence integer not null check (event_sequence > 0),
  final_event text null check (final_event is null or final_event in ('user_earned_reward', 'dismissed', 'failed')),
  show_to_reward_ms integer null check (show_to_reward_ms is null or show_to_reward_ms >= 0),
  reward_to_dismiss_ms integer null check (reward_to_dismiss_ms is null or reward_to_dismiss_ms >= 0),
  show_to_dismiss_ms integer null check (show_to_dismiss_ms is null or show_to_dismiss_ms >= 0),
  client_at timestamptz not null,
  app_version text null,
  build_version text null,
  deployment_id text null,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orbitslash_rewarded_ad_events_placement_created_idx
  on public.orbitslash_rewarded_ad_events(placement, created_at desc);

create index if not exists orbitslash_rewarded_ad_events_name_created_idx
  on public.orbitslash_rewarded_ad_events(event_name, created_at desc);

create index if not exists orbitslash_rewarded_ad_events_session_seq_idx
  on public.orbitslash_rewarded_ad_events(session_trace_id, event_sequence asc);

alter table public.orbitslash_rewarded_ad_events enable row level security;

revoke all on table public.orbitslash_rewarded_ad_events from anon, authenticated;

comment on table public.orbitslash_rewarded_ad_events is
  'Orbit Slash rewarded-ad lifecycle telemetry. Public clients write only through the dedicated Edge Function.';

comment on column public.orbitslash_rewarded_ad_events.client_event_id is
  'Client-generated idempotency key for SDK callback duplication.';

comment on column public.orbitslash_rewarded_ad_events.session_trace_id is
  'Random app/session trace identifier. Do not store raw Toss userKey or device identifiers here.';

comment on column public.orbitslash_rewarded_ad_events.reward_earned is
  'True only after the SDK emits userEarnedReward or platform-equivalent earned callback.';

comment on column public.orbitslash_rewarded_ad_events.dismissed is
  'True only after the official SDK dismiss/close lifecycle event.';
