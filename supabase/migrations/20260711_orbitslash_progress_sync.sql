create table if not exists public.orbitslash_progress_snapshots (
  core_user_id uuid primary key references public.core_users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  snapshot_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orbitslash_progress_mutations (
  id uuid primary key,
  core_user_id uuid not null references public.core_users(id) on delete cascade,
  mutation_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  received_at timestamptz not null default now()
);

create table if not exists public.orbitslash_reward_claims (
  id uuid primary key default gen_random_uuid(),
  core_user_id uuid not null references public.core_users(id) on delete cascade,
  reward_key text not null,
  claim_key text not null unique,
  created_at timestamptz not null default now()
);

alter table public.orbitslash_progress_snapshots enable row level security;
alter table public.orbitslash_progress_mutations enable row level security;
alter table public.orbitslash_reward_claims enable row level security;
revoke all on table public.orbitslash_progress_snapshots from anon, authenticated;
revoke all on table public.orbitslash_progress_mutations from anon, authenticated;
revoke all on table public.orbitslash_reward_claims from anon, authenticated;

create index if not exists orbitslash_progress_mutations_user_created_idx
  on public.orbitslash_progress_mutations (core_user_id, created_at desc);

comment on table public.orbitslash_progress_snapshots is
  'Orbit Slash full progress replica. Edge-only writes after verified identity mapping.';
