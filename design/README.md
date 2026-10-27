# Pulse

Anonymous, live crowd-density heatmap. Devices report a ~460 m H3 cell id — never a
coordinate. Cells with fewer than 5 distinct contributors are never returned. Everything
is deleted after 20 minutes.

`Pulse.dc.html` in this project is the working design prototype: real MapLibre map, real
client-side H3 conversion, real consent state machine, mocked backend (`mock-backend.js`
implements the same rules as the SQL).

## Setup

1. **Supabase** — create a project, then run the migration:
   ```
   supabase link --project-ref <ref>
   supabase db push          # or paste supabase/migrations/0001_init.sql into the SQL editor
   ```
   `pg_cron` must be enabled (Database → Extensions) before the migration runs.
2. **Basemap** — optional. Get a free key at maptiler.com and set
   `NEXT_PUBLIC_MAPTILER_KEY`. Without it the app uses a keyless OSM/CARTO dark raster
   style.
3. **Env** — `cp .env.example .env.local` and fill in the Supabase URL + anon key.
4. **Run** — `npm install && npm run dev`.
5. **Deploy** — Vercel: import the repo, add the same env vars, deploy.

## Privacy architecture

| Rule | Where it is enforced |
| --- | --- |
| Raw lat/lng never leaves the device | `location-privacy.js` — the only module that touches `navigator.geolocation`; the coordinate is converted inside a block scope and never returned, stored, or logged |
| Coarse cell only | H3 resolution 8, ~460 m edge |
| Rotating pseudonym | `anon_id` UUID in `localStorage`, regenerated every 24 h or on demand |
| No raw reads | `public.pings` has no RLS select policy; `select` is revoked from `anon` |
| k-anonymity | `aggregate_density()` — `having count(distinct anon_id) >= 5` |
| Fuzzed counts | rounded to the nearest 5 in SQL |
| 20 min retention | `pg_cron` job `pulse_purge_pings`, every minute |
| Withdrawal deletes | `delete_my_pings(anon_id)` — outstanding pings removed, not just future ones |
| Browsing needs nothing | the read RPC requires no auth and no consent |

## Consent

Three independent purposes (`location`, `analytics`, `updates`), each defaulting to off,
each separately revocable, no bundled accept-all. State is stored locally with a timestamp
and `POLICY_VERSION`; a version bump re-prompts. Grants and revocations are also written to
`consent_records`.

## Client behaviour

- Report every 3 minutes while foregrounded and location sharing is on.
- Poll `aggregate_density()` every 30 seconds regardless of consent state.
- Geolocation denied at OS level is treated exactly like "Just browse".
- No data below the threshold is invented: the map shows "Not enough people here yet".
