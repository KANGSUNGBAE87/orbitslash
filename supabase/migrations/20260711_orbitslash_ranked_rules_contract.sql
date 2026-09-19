-- Binds every issued ranked token to the exact generated rules contract.
-- Existing historical drafts remain non-submittable: they are explicitly marked
-- legacy-unbound instead of being silently treated as the current ruleset.

alter table public.orbitslash_runs
  add column if not exists rules_hash text,
  add column if not exists rules_version integer;

update public.orbitslash_runs
set
  rules_hash = coalesce(nullif(btrim(rules_hash), ''), 'legacy-ranked-rules-unbound'),
  rules_version = coalesce(rules_version, 0)
where rules_hash is null
   or btrim(rules_hash) = ''
   or rules_version is null;

alter table public.orbitslash_runs
  alter column rules_hash set not null,
  alter column rules_version set not null;

comment on column public.orbitslash_runs.rules_hash is
  'Generated ranked-core rules hash captured when the ranked token was issued.';
comment on column public.orbitslash_runs.rules_version is
  'Generated ranked-core schema version captured when the ranked token was issued.';
