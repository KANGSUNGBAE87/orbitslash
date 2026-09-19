create table if not exists public.orbitslash_entitlements (
  id uuid primary key default gen_random_uuid(),
  core_user_id uuid not null references public.core_users(id) on delete cascade,
  product_id text not null,
  provider text not null check (provider in ('google_play', 'apps_in_toss')),
  provider_receipt_hash text not null unique,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (core_user_id, product_id, provider)
);

alter table public.orbitslash_entitlements enable row level security;
revoke all on table public.orbitslash_entitlements from anon, authenticated;
create index if not exists orbitslash_entitlements_active_idx on public.orbitslash_entitlements (core_user_id, product_id) where revoked_at is null;

comment on table public.orbitslash_entitlements is
  'Orbit Slash cosmetic-only entitlements. Receipts are verified server-side before any grant.';
