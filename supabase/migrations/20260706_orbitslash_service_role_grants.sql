-- Orbit Slash Edge Function service-role grants.
-- Public clients stay blocked by RLS/revokes. Server Edge Functions use service_role.

grant usage on schema public to service_role;

grant select, insert, update on table public.orbitslash_runs to service_role;
grant select, insert, update on table public.orbitslash_scores to service_role;
grant select, insert, update on table public.orbitslash_telemetry_events to service_role;
grant select, insert, update on table public.orbitslash_rewarded_ad_events to service_role;
grant select, insert, update on table public.orbitslash_gameplay_events to service_role;

grant usage, select on sequence public.orbitslash_gameplay_events_id_seq to service_role;
