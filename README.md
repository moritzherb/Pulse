# Pulse

A native iOS and Android app that shows how busy places are right now, as a live,
anonymous crowd-density heatmap.

- Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript (strict)
- MapLibre React Native with OpenFreeMap vector tiles
- Supabase (Postgres + PostGIS, Edge Functions, Realtime, anonymous auth)
- Uber H3 cells at resolution 8 (~460 m). Raw coordinates never leave the phone.

The visual source of truth is [`design/Pulse.dc.html`](design/Pulse.dc.html), a Claude
Design prototype. The app re-implements it natively; it does not embed it.

## Status

| Phase | Scope                                                                       | State |
| ----- | --------------------------------------------------------------------------- | ----- |
| 1a    | Expo project, design tokens, core components, token gallery                 | done  |
| 1b    | Navigation, screens shells, MapLibre map with mock Vienna heat              | next  |
| 2     | Supabase schema + RLS, anonymous auth, ping pipeline, k-anonymity, Realtime |       |
| 3     | Venues (OSM import) and the cell / venue detail sheet                       |       |
| 4     | Full design pass: onboarding, settings, animation, dark mode, accessibility |       |
| 5     | Retention jobs, privacy policy, store metadata, EAS build, TestFlight       |       |

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
   cp .env.example .env   # nothing to fill in yet for Phase 1
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
   Phase 1a opens the design-token gallery (`/dev/tokens`).

Simulator alternative (Mac with Xcode): `eas build --profile development-simulator
--platform ios`, or `npx expo run:ios`.

## Scripts

| Command             | What it does                         |
| ------------------- | ------------------------------------ |
| `npm start`         | Dev server for the development build |
| `npm run typecheck` | `tsc --noEmit` (strict)              |
| `npm run lint`      | ESLint (eslint-config-expo)          |
| `npm run format`    | Prettier                             |

## Project layout

```
src/app/              Expo Router routes (screens)
src/components/ui/    Core components built on the design tokens
src/theme/            Tokens (colour, type, spacing, radii, shadows, motion), ThemeProvider
src/lib/              Storage and (later) Supabase client
supabase/functions/   Edge Functions; _shared/ is imported by the app as @shared/*
design/               The Claude Design prototype (reference only)
```

## Secrets

Keys live in `.env` (git-ignored). Only `EXPO_PUBLIC_*` values are bundled into the app,
and only values that are public by design (Supabase URL and anon key) go there. The
Supabase service-role key is never used by the app.
