# orbitslash-rewarded-ad-telemetry

Local Supabase Edge Function draft for Orbit Slash rewarded-ad lifecycle telemetry.

## Contract

- `POST { "action": "record", "events": [...] }`
- Accepts at most 20 rewarded-ad lifecycle events per request.
- Writes to `public.orbitslash_rewarded_ad_events` with service-role credentials.
- Uses `clientEventId` as the idempotency key for duplicated SDK callbacks.
- Rejects raw identifiers and sensitive fields such as Toss `userKey`,
  advertising/device IDs, invite codes, nicknames, answer payloads, and full URLs.

## Not Done Here

- This does not enable Free Defense revive CTA.
- Remote migration apply and Edge deployment are intentionally not done until
  Owner explicitly asks.
- Public clients must not write directly to the telemetry table.
