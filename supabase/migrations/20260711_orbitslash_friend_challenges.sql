-- Orbit Slash asynchronous friend challenge draft. Apply/deploy only with Owner approval.
-- Share tokens are hashed server-side; provider IDs, friend lists, and raw tokens are never stored.

create table if not exists public.orbitslash_friend_challenges (
  id uuid primary key default gen_random_uuid(),
  owner_core_user_id uuid not null references public.core_users(id) on delete cascade,
  token_hash text not null unique,
  seed bigint not null check (seed >= 0),
  difficulty text not null,
  rules_hash text not null,
  rules_version integer not null check (rules_version > 0),
  config_version text not null,
  expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'expired')),
  accepted_by_core_user_id uuid null references public.core_users(id) on delete set null,
  accepted_run_id uuid null references public.orbitslash_runs(id) on delete restrict,
  accepted_score_id uuid null references public.orbitslash_scores(id) on delete restrict,
  accepted_at timestamptz null,
  accepted_result_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(accepted_result_metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (accepted_by_core_user_id is null or accepted_by_core_user_id <> owner_core_user_id)
);

alter table public.orbitslash_friend_challenges enable row level security;
revoke all on table public.orbitslash_friend_challenges from anon, authenticated;

create index if not exists orbitslash_friend_challenges_owner_created_idx
  on public.orbitslash_friend_challenges (owner_core_user_id, created_at desc);

create index if not exists orbitslash_friend_challenges_expires_idx
  on public.orbitslash_friend_challenges (expires_at);

create index if not exists orbitslash_friend_challenges_owner_status_expiry_idx
  on public.orbitslash_friend_challenges (owner_core_user_id, status, expires_at);

-- DB-clock atomic claim: Edge verifies identity, token, rules, and ranked result first;
-- this function owns the final time/owner/status predicate and result write.
create or replace function public.orbitslash_accept_friend_challenge(
  p_challenge_id uuid,
  p_accepting_core_user_id uuid,
  p_run_id uuid,
  p_score_id uuid,
  p_result_metadata jsonb
)
returns table (id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.orbitslash_friend_challenges as challenge
  set
    status = 'accepted',
    accepted_by_core_user_id = p_accepting_core_user_id,
    accepted_run_id = p_run_id,
    accepted_score_id = p_score_id,
    accepted_at = now(),
    accepted_result_metadata = p_result_metadata
  where challenge.id = p_challenge_id
    and challenge.status = 'open'
    and challenge.owner_core_user_id <> p_accepting_core_user_id
    and challenge.expires_at > now()
  returning challenge.id, challenge.status;
end;
$$;

revoke all on function public.orbitslash_accept_friend_challenge(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.orbitslash_accept_friend_challenge(uuid, uuid, uuid, uuid, jsonb) to service_role;

comment on table public.orbitslash_friend_challenges is
  'Edge-only asynchronous challenge contracts. Stored result metadata is derived from a server-verified ranked score.';
