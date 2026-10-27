# Pulse

A native iOS and Android app that shows how busy places are right now, as a live,
anonymous crowd-density heatmap.

- Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript (strict)
- MapLibre React Native with OpenFreeMap vector tiles
- Supabase (Postgres + PostGIS, Edge Functions, Realtime, anonymous auth)
- Uber H3 cells at resolution 8 (~460 m). Raw coordinates never leave the phone.

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
| 3     | Venues (OSM import) and the cell / venue detail sheet                       | done  |
| 4     | Full design pass: onboarding, settings, animation, dark mode, accessibility | done  |
| 5     | Retention jobs, privacy policy, store metadata, EAS build, TestFlight       | done  |

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
   npx supabase functions deploy ping delete-me
   # optional: npx supabase secrets set PING_MIN_ACCOUNT_AGE_SECONDS=120
   ```
5. Fill in `.env`: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   (**Project Settings → API**), and `DATABASE_URL` (**Connect → Session pooler**) for
   the seed script. Restart `npm start`.

### Venues and place names (OpenStreetMap)

```sh
npm run import:osm              # downloads Vienna from the Overpass API and upserts it
npm run import:osm -- --save vienna.json     # keep the raw download
npm run import:osm -- --from vienna.json     # re-import offline
```

Imports bars, pubs, clubs, restaurants, cafés, markets, museums, galleries, sights,
theatres, parks and gardens (venues), and neighbourhoods and squares (place names for
labels). Venues closed in OSM are removed on the next run, so run it every week or two.
Data © OpenStreetMap contributors (ODbL); the app credits it in Settings and in the
detail sheet. Needs `DATABASE_URL`, like the seed.

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

| Step                                                                                               | Where                                         |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Phone converts its position to an H3 cell (res 8) and drops the coordinate                         | `src/features/location/privacyBoundary.ts`    |
| Every 3 min while open and sharing, and on entering a new cell: `POST /ping { cell }`              | `src/features/sharing/`                       |
| Edge Function checks the session and the cell, then `record_ping()` rate-limits and stores it      | `supabase/functions/ping`, `record_ping()`    |
| Every minute: distinct devices per cell over 15 min, cells under 5 dropped, rounded to 5, labelled | `refresh_live_cells()`                        |
| Changes are broadcast per region (`region:<res-5 cell>`), plus a heartbeat (`pulse:tick`)          | `realtime.send()`                             |
| App reads `live_cells` around the map and applies broadcasts                                       | `src/features/density/useDensity.ts`          |
| At street zoom the app loads venue pins for the viewport                                           | `venues_in_bbox()`, `src/features/venues/`    |
| Tapping a cell, list row or pin opens the detail sheet: live level, trend, usual busyness, venues  | `get_cell_detail()`, `src/components/detail/` |
| Every 15 min the k-anonymous counts are added to hourly history                                    | `snapshot_hourly()`                           |
| Pings deleted after 20 min; anonymous users after 25 h; history after 12 months                    | `purge_expired_pings()`, `purge_retention()`  |

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
| `npm run import:osm`      | Venues and place names from OpenStreetMap          |
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
scripts/              Seed script (simulated Vienna crowds) and OSM import (scripts/osm/)
design/               The Claude Design prototype (reference only)
```

## Privacy boundary

`src/features/location/privacyBoundary.ts` is the only file allowed to read the device
position (enforced by an ESLint `no-restricted-imports` rule). It turns the position into
an H3 cell inside a block scope and returns only cell ids. The map centres on the centre
of your ~460 m cell, never on your exact position.

## Basemap

OpenFreeMap's Positron vector style (no key, OpenStreetMap data): the same cartography
as the CARTO raster in the design prototype. Dark mode recolours Positron on the device
(`src/features/map/mapStyle.ts`), since OpenFreeMap has no matching dark variant.

## Secrets

Keys live in `.env` (git-ignored). Only `EXPO_PUBLIC_*` values are bundled into the app,
and only values that are public by design (Supabase URL and anon key) go there. The
service-role key exists only inside Supabase (Edge Functions); the app never sees it.
`DATABASE_URL` is used only by the seed script on your computer.
