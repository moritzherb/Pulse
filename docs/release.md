# Release checklist

From a working development setup to TestFlight and Google Play internal testing.
Commands assume the repo root. Items marked **(you)** need your accounts or decisions.

## 0. Before anything is public

- [ ] **(you)** Final app name, reserved in App Store Connect (`APP_NAME` in `app.config.ts`).
- [ ] **(you)** Controller name, address, privacy email, supervisory authority, support URL:
      fill the `{{PLACEHOLDERS}}` in `docs/privacy-policy.md`, the "Contact" section in
      `src/features/privacy/policy.ts`, and `docs/store-listing.md`.
- [ ] **(you)** Have the privacy policy reviewed, then publish it at a public URL
      (GitHub Pages from `docs/`, or any static host).
- [ ] If the policy text changed since the last build, bump `EXPO_PUBLIC_POLICY_VERSION`.
- [ ] Decide the App Store "linked to you" answer (see `docs/store-privacy.md`) and keep
      `ios.privacyManifests` in `app.config.ts` consistent with it.

## 1. Production backend (separate from development)

Use a **new** Supabase project for production. Never run the seed script against it.

```sh
npx supabase link --project-ref <prod-ref>
npx supabase db push                          # schema, RLS, jobs, retention
npx supabase functions deploy ping delete-me import-region
npx supabase secrets set PING_MIN_ACCOUNT_AGE_SECONDS=120 PING_MIN_INTERVAL_SECONDS=60
DATABASE_URL=<prod session pooler url> npm run import:osm -- --yes --city Vienna   # launch city ahead of time, no seed
```

Every other region is imported on demand by `import-region`. The public Overpass servers
are a shared, free service with a fair-use limit; `IMPORT_MAX_PER_HOUR` (default 30)
keeps Pulse within it. Once usage grows, run your own Overpass instance and point
`OVERPASS_URL` at it:

```sh
npx supabase secrets set OVERPASS_URL=https://overpass.example.org/api/interpreter IMPORT_MAX_PER_HOUR=200
```

In the dashboard:

- [ ] Region in the EU (for example Frankfurt), matching the privacy policy.
- [ ] Authentication → Sign In / Providers: **Anonymous sign-ins on**; email, phone and
      social providers **off** (the app uses none).
- [ ] Authentication → Rate limits: keep anonymous sign-ins low (the default 30 per hour
      per IP is fine). Optionally enable CAPTCHA protection later.
- [ ] Database → Extensions: `postgis` and `pg_cron` enabled (the migration does this;
      enable them by hand if it reports that it could not).
- [ ] Sign the Supabase Data Processing Agreement (Organization settings → Legal).
- [ ] After an hour, check retention in the SQL editor (see below).

```sql
select public.retention_status();
select public.audit_log_oldest_hours();
```

Expect `oldest_ping_minutes` under ~21, `anonymous_users_over_25h` 0, every job's
`last_status` "succeeded", and an audit log age under ~26 h. If the audit log age is
`null`, the project does not allow the cleanup: turn off Auth audit logging in the
dashboard if available, and say so in the privacy policy.

## 2. EAS configuration

```sh
npm i -g eas-cli && eas login
eas init                                         # once, links the Expo project
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<prod-ref>.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <prod anon key> --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_POLICY_VERSION --value 2026-10-29 --visibility plaintext
```

The anon / publishable key is public by design (it ships in the app; RLS protects the
data). The service-role key never goes into EAS or the app.

## 3. iOS: TestFlight

**(you)** Apple Developer Program membership.

1. App Store Connect → My Apps → **+** → New App: platform iOS, name, primary language,
   bundle ID `com.moritzherb.pulse`, SKU (any).
2. Put the app's numeric Apple ID into `eas.json` → `submit.production.ios.ascAppId`
   (or let `eas submit` ask).
3. Build and upload:
   ```sh
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```
4. App Store Connect, while the build processes:
   - App Privacy: answers from `docs/store-privacy.md`; privacy policy URL.
   - Age rating questionnaire (all "None" → 4+), category Travel / Navigation.
   - Export compliance is pre-answered (`ITSAppUsesNonExemptEncryption = false`).
5. TestFlight → Internal Testing → add yourself → install via the TestFlight app.
   External testers need a short Beta App Review (use the review notes in
   `docs/store-listing.md`).

## 4. Android: Google Play internal testing

**(you)** Google Play Console account.

1. Create the app (name, default language, free, "App", accept declarations).
2. Fill App content: privacy policy URL, ads (No), app access (all functionality
   available), content rating (IARC), target audience (16+), **Data safety** from
   `docs/store-privacy.md`.
3. Build: `eas build --platform android --profile production` (an `.aab`).
4. The **first** upload of a new app must be done by hand: Play Console → Testing →
   Internal testing → Create release → upload the `.aab` from the EAS build page.
5. For later releases, create a Google service account with release permissions,
   download its JSON key (never commit it), set
   `submit.production.android.serviceAccountKeyPath` in `eas.json`, and run
   `eas submit --platform android --latest` (track `internal`, draft).

## 5. Release candidate checks

- [ ] `npm run typecheck && npm run lint && npm test && npm run db:test`
- [ ] A production build shows **no** simulated data and no `/dev/tokens` (both are
      development-only; a missing backend shows the offline state).
- [ ] Consent: "Just browse" never triggers the location prompt; "Share anonymously"
      does, once.
- [ ] "What's sent" shows the area and last update after sharing for a few minutes.
- [ ] Switching sharing off shows how many reports were deleted.
- [ ] "Delete my data now" (two taps) returns to the consent screen; in the SQL editor the
      old random ID no longer exists in `auth.users`.
- [ ] VoiceOver: the "Busiest now" list reads level, count and trend for each row.
- [ ] Increase Contrast, Reduce Motion, largest Dynamic Type, dark mode: nothing clipped.

## 6. Launch note: the empty map

Areas appear only with five or more devices. On day one, with few users, most of the map
will honestly say "Not enough people here yet". Plan the launch around one city
(Vienna), and pick places and times where early users are concentrated (a university, an
event, a district), rather than filling the map with simulated data, which the app never
shows in store builds.
