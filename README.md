# Pulse

A native iOS and Android app that shows how busy places are right now, as a live,
anonymous crowd-density heatmap.

- Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript (strict)
- MapLibre React Native with OpenFreeMap vector tiles
- Supabase (Postgres + PostGIS, Edge Functions, Realtime, anonymous auth)
- Crowds are counted per place (every named café, bar, museum, square and park from
  OpenStreetMap). The phone finds the place it is at by itself; coordinates never leave it.

The visual source of truth is [`design/Pulse.dc.html`](design/Pulse.dc.html), a Claude
Design prototype. The app re-implements it natively; it does not embed it.
[`docs/design-notes.md`](docs/design-notes.md) lists what was taken as is, what was
filled in where the design is silent, and the accessibility features.

| Document                                           | What it is                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| [`docs/try-it.md`](docs/try-it.md)                 | Simple step-by-step: run Pulse on your phone                                |
| [`docs/release.md`](docs/release.md)               | Release checklist: production backend, EAS, TestFlight, Google Play         |
| [`docs/privacy-policy.md`](docs/privacy-policy.md) | Privacy policy draft (placeholders for the controller details)              |
| [`docs/store-privacy.md`](docs/store-privacy.md)   | App Store privacy label and Google Play Data safety answers, mapped to code |
| [`docs/store-listing.md`](docs/store-listing.md)   | Store copy, review notes, screenshot list                                   |
| [`docs/design-notes.md`](docs/design-notes.md)     | Design decisions, fill-ins, accessibility                                   |

## Status

| Phase | Scope                                                                       | State |
| ----- | --------------------------------------------------------------------------- | ----- |
| 1a    | Expo project, design tokens, core components, token gallery                 | done  |
| 1b    | Navigation, screen shells, MapLibre map with mock Vienna heat               | done  |
| 2     | Supabase schema + RLS, anonymous auth, ping pipeline, k-anonymity, Realtime | done  |
| 3     | Venues (OSM import) and the detail sheet                                    | done  |
| 4     | Full design pass: onboarding, settings, animation, dark mode, accessibility | done  |
| 5     | Retention jobs, privacy policy, store metadata, EAS build, TestFlight       | done  |
| 6     | Crowds per place: outlines, matching on the phone, place heatmap            | done  |

## Setup from zero

You need a Mac only if you want to build locally. EAS builds in the cloud.

1. **Tools**
   - Node.js 22 LTS (`node -v`)
   - An [Expo account](https://expo.dev/signup) and the EAS CLI: `npm i -g eas-cli`, then `eas login`
   - An Apple Developer Program membership (needed to install a development build on a
     real iPhone)
2. **Install**
   ```sh
   git clone https://github.com/moritzherb/Pulse.git && cd Pulse
   npm install
   cp .env.example .env   # fill in after setting up the backend (below)
   ```
3. **Development build for your iPhone** (the app uses native modules, so Expo Go will
   not work)
   ```sh
   eas init                                   # links the project to your Expo account, once
   eas device:create                          # registers your iPhone, once
   eas build --profile development --platform ios
   ```
   Install the build from the link/QR code EAS prints. On iOS 16+ enable
   _Settings → Privacy & Security → Developer Mode_ when asked.
4. **Run**
   ```sh
   npm start
   ```
   Open the installed Pulse dev app on the phone; it connects to the dev server.
   First launch shows the consent screen, then the map. Without Supabase keys in `.env`
   the map shows simulated Vienna data. The design-token gallery is at `/dev/tokens` in
   development builds.

Simulator alternative (Mac with Xcode): `eas build --profile development-simulator
--platform ios`, or `npx expo run:ios`.

## Backend (Supabase)

### Hosted project

1. Create a project at [supabase.com](https://supabase.com). Pick an EU region (for
   example Frankfurt) to keep data in the EU.
2. **Authentication → Sign In / Providers → Anonymous sign-ins**: turn on. (The
   `supabase/config.toml` setting only applies to the local stack.)
3. Link and push the schema:
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push            # applies supabase/migrations (PostGIS, pg_cron, RLS, jobs)
   ```
   If the migration reports that `pg_cron` or `postgis` is not available, enable them
   under **Database → Extensions** and push again.
4. Deploy the Edge Functions:
   ```sh
   npx supabase functions deploy ping delete-me import-region
   # optional: npx supabase secrets set PING_MIN_ACCOUNT_AGE_SECONDS=120
   ```
5. Fill in `.env`: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   (**Project Settings → API**), and `DATABASE_URL` (**Connect → Session pooler**) for
   the seed script. Restart `npm start`.

### Venues and place names (OpenStreetMap)

Pulse works anywhere in the world. Places are imported per region (H3 resolution 5,
about 250 km²) **on demand**: the first time someone shares in a region, or looks at it
at street zoom, the app calls the `import-region` Edge Function. It fetches the region
from the Overpass API in the background (a minute or two) and keeps it for 30 days. At
most 30 regions start per hour across everyone (`IMPORT_MAX_PER_HOUR`), to stay a
polite user of the public Overpass servers; set `OVERPASS_URL` to use your own.

To import ahead of time (for example a launch city), run the same importer locally:

```sh
npm run import:osm                                 # Vienna and the ring of regions around it
npm run import:osm -- --city "Paris,Berlin"        # any city from the search list
npm run import:osm -- --region 851e15b7fffffff     # specific regions
npm run import:osm -- --city Vienna --force        # re-import even if fresh
```

Imports bars, pubs, clubs, restaurants, cafés, markets, museums, galleries, sights,
theatres, cinemas, parks, gardens, squares and more (venues, with outlines and time
zone), and neighbourhoods (place names for labels). Venues closed in OSM are removed
when their region is re-imported. Data © OpenStreetMap contributors (ODbL); the app
credits it in Settings and in the detail sheet. Needs `DATABASE_URL`, like the seed.

The city search list (`src/data/worldCities.ts`, 4,352 cities) is generated with
`npm run cities` from GeoNames (CC BY 4.0) and bundled, so searches never leave the
phone.

### Simulated Vienna data

```sh
npm run seed                    # places, venues and 28 days of hourly history
npm run seed -- --live          # plus synthetic devices pinging every minute (Ctrl+C stops)
npm run seed -- --reset         # remove everything the seed created
```

Everything the seed writes is marked as synthetic (users flagged in
`raw_app_meta_data`, places / venues with `source = 'seed'`, venue names ending in
"(simulated)"). Live mode writes raw pings and runs the real aggregation, so the
5-device minimum, rounding and Realtime broadcasts are exercised end to end. It refuses
non-local databases unless you pass `--yes`. Never seed a production project.

### Local stack (optional, needs Docker)

```sh
npx supabase start              # prints the local URL and keys for .env
npx supabase db reset           # applies migrations
npx supabase functions serve --env-file supabase/functions/.env
```

### How the pipeline works

| Step                                                                                  | Where                                                |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Places are imported per region from OSM, on demand (`import-region`) or ahead of time | `supabase/functions/_shared/osm/`                    |
| While sharing, the phone downloads the outlines of its region (~250 km²) once a week  | `venue_shapes()`, `src/features/places/`             |
| It matches its position to the smallest place it is in, then drops the position       | `src/features/location/privacyBoundary.ts`           |
| After 2 min at the same place, every 3 min while open: `POST /ping { venue }`         | `src/features/sharing/`                              |
| Edge Function checks the session and the id, then `record_ping()` rate-limits it      | `supabase/functions/ping`, `record_ping()`           |
| Every minute: distinct devices per place over 15 min, under 5 dropped, rounded to 5   | `refresh_live_venues()`                              |
| Level: against the place's usual peak (`refresh_usual_peaks()`, daily), else fixed    | `level_for_place()`, `_shared/levels.ts`             |
| Changes are broadcast per region (`region:<res-5 cell>`), plus a heartbeat            | `realtime.send()`                                    |
| App reads `live_venues` around the map and draws a heatmap on the places              | `useDensity.ts`, `src/components/map/HeatLayers.tsx` |
| Tapping a place, list row or pin opens the detail sheet: level, trend, usual, nearby  | `get_venue_detail()`, `src/components/detail/`       |
| Every 15 min the k-anonymous counts are added to hourly history                       | `snapshot_hourly()`                                  |
| Pings deleted after 20 min; anonymous users after 25 h; history after 12 months       | `purge_expired_pings()`, `purge_retention()`         |

### Checking retention

```sql
select public.retention_status();        -- SQL editor (service role)
```

Oldest raw ping (should stay under ~21 min), anonymous identities past 25 h (should be
0), oldest history row, and the last run of each Pulse cron job. The hourly job also
deletes Supabase Auth audit-log rows (which contain IP addresses) older than 25 h.

### Database tests

```sh
npx supabase test db            # with the local stack
npm run db:test                 # or against a plain local Postgres with PostGIS, pg_cron, pgTAP
```

## Scripts

| Command                   | What it does                                       |
| ------------------------- | -------------------------------------------------- |
| `npm start`               | Dev server for the development build               |
| `npm run typecheck`       | `tsc --noEmit` (strict)                            |
| `npm run lint`            | ESLint (eslint-config-expo)                        |
| `npm run format`          | Prettier                                           |
| `npm test`                | Jest unit tests (levels, H3, mock data, map style) |
| `npm run seed`            | Simulated Vienna data (see Backend)                |
| `npm run import:osm`      | Import places ahead of time (city or region)       |
| `npm run cities`          | Regenerate the city search list from GeoNames      |
| `npm run db:test`         | Migrations + pgTAP tests on a local Postgres       |
| `npm run functions:check` | Type-check the Edge Functions with Deno            |

## Project layout

```
src/app/              Expo Router routes (screens)
src/components/ui/    Core components built on the design tokens
src/theme/            Tokens (colour, type, spacing, radii, shadows, motion), ThemeProvider
src/features/         Consent, location privacy boundary, density data, map screen
src/components/map/   Heat layers, top bar, controls, "Busiest now" card, empty state
src/features/sharing/ Ping loop (SharingEngine) and the one function that sends a ping
src/features/detail/  Detail sheet data (get_cell_detail) and "usually busy at" helpers
src/features/venues/  Venue pins for the viewport
src/components/detail/ Detail bottom sheet and the usual-busyness chart
src/features/identity/ Rotating anonymous identity (Supabase anonymous auth)
src/lib/              Storage, Supabase client, H3 helpers, small utilities
src/data/             Bundled city list for search (no geocoding service)
supabase/migrations/  Schema, RLS, aggregation, retention, cron jobs (SQL)
supabase/functions/   Edge Functions (ping, delete-me); _shared/ is imported by the app as @shared/*
supabase/tests/       pgTAP tests (RLS, k-anonymity, retention) and a local runner
scripts/              Seed script (simulated Vienna crowds), OSM import, city list generator
design/               The Claude Design prototype (reference only)
```

## Privacy boundary

`src/features/location/privacyBoundary.ts` is the only file allowed to read the device
position (enforced by an ESLint `no-restricted-imports` rule). Inside a block scope it
looks up the public place the position falls in (using outlines already on the phone)
and returns only that place's id, plus H3 cell ids for the private-area check and for
centring the map on your ~460 m area. The position itself is never returned. Nothing is
sent when the phone is not at a place, or when the position is less accurate than 50 m.

## Basemap

OpenFreeMap's Positron vector style (no key, OpenStreetMap data): the same cartography
as the CARTO raster in the design prototype. Dark mode recolours Positron on the device
(`src/features/map/mapStyle.ts`), since OpenFreeMap has no matching dark variant.

## Secrets

Keys live in `.env` (git-ignored). Only `EXPO_PUBLIC_*` values are bundled into the app,
and only values that are public by design (Supabase URL and anon key) go there. The
service-role key exists only inside Supabase (Edge Functions); the app never sees it.
`DATABASE_URL` is used only by the seed script on your computer.
