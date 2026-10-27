# Store privacy answers

The App Store privacy label ("App Privacy") and the Google Play Data safety form,
answered from what the code does. Every answer points to the code that makes it true.
If the code changes, update this file, the privacy manifest in `app.config.ts`, and
`docs/privacy-policy.md` together.

## What leaves the phone

| Data                                                                   | When                                                                              | Code                                                                                     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| H3 cell id, resolution 8 (~460 m)                                      | Only while sharing, every 3 min while the app is open, and on entering a new cell | `src/features/sharing/sharing.ts` (`sendPing`), body is exactly `{ cell }` (unit-tested) |
| Random anonymous user id (Supabase anonymous auth), as a session token | Only while sharing                                                                | `src/features/identity/identity.ts`                                                      |
| Consent record (purpose, yes/no, policy version)                       | When an id is created and when sharing is switched off                            | `recordConsent()`                                                                        |
| Map viewport / region ids, time zone                                   | While browsing (public data requests)                                             | `useDensity.ts`, `useVenues.ts`, `useCellDetail.ts`                                      |
| IP address                                                             | Any network request (inherent)                                                    | Supabase, OpenFreeMap                                                                    |

Never collected: precise location (converted on device in
`src/features/location/privacyBoundary.ts`, the only module allowed to read it),
name, email, phone number, contacts, photos, device identifiers (IDFA / IDFV / Android
ID), advertising data, analytics, crash data.

Retention (server, `supabase/migrations/`): pings 20 min; anonymous users, their
consent records, sessions and auth audit log entries 25 h; anonymous hourly aggregates
12 months.

---

## Apple: App Privacy (App Store Connect)

**Do you or your third-party partners collect data from this app?** Yes.

| Data type                      | Collected | Linked to the user's identity | Used for tracking | Purposes          |
| ------------------------------ | --------- | ----------------------------- | ----------------- | ----------------- |
| Location → **Coarse Location** | Yes       | **No**                        | No                | App Functionality |
| Identifiers → **User ID**      | Yes       | **No**                        | No                | App Functionality |

Everything else: **Not collected** (Contact Info, Health & Fitness, Financial Info,
Precise Location, Sensitive Info, Contacts, User Content, Browsing History, Search
History, Identifiers → Device ID, Purchases, Usage Data, Diagnostics, Other Data).

Why "Coarse Location": Apple defines coarse location as lower resolution than three
decimal places of latitude and longitude; an H3 resolution-8 cell (~460 m) is coarser.

Why "User ID" and why "not linked": the random id is an assigned identifier, so it is
declared. It is not linked to identity because it is created by the app for this
purpose only, is not derived from the device or the person, is replaced every 24 hours,
is never combined with any other data about the person, and is deleted within 25 hours.

> **Judgement call to confirm before submitting:** Apple's definition of "linked" is
> strict. If you want the most conservative label, mark both types as **Linked to You**.
> That is allowed and safe, only less flattering. Keep the privacy manifest
> (`NSPrivacyCollectedDataTypeLinked` in `app.config.ts`) consistent with whichever you choose.

**Tracking:** No. (`NSPrivacyTracking: false`; no App Tracking Transparency prompt,
no IDFA.)

**Privacy manifest** (`ios.privacyManifests` in `app.config.ts`, verified in a
prebuild): collected types Coarse Location + User ID (not linked, no tracking, App
Functionality); required-reason APIs UserDefaults CA92.1, FileTimestamp C617.1,
SystemBootTime 35F9.1, DiskSpace E174.1.

**Info.plist permissions** (verified in a prebuild): only
`NSLocationWhenInUseUsageDescription`. No background location, no "Always", no
motion, no precise-location upgrade.

---

## Google Play: Data safety

**Does your app collect or share any of the required user data types?** Yes.

**Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS only).

**Do you provide a way for users to request that their data is deleted?** Yes: in the
app, Settings → "Delete my data now" (and switching off sharing deletes sent reports).
Also by email to the privacy contact.

| Category → type                               | Collected | Shared | Processed ephemerally | Required or optional                         | Purposes          |
| --------------------------------------------- | --------- | ------ | --------------------- | -------------------------------------------- | ----------------- |
| Location → **Approximate location**           | Yes       | No     | No (kept 20 min)      | **Optional** (the app works without sharing) | App functionality |
| Device or other IDs → **Device or other IDs** | Yes       | No     | No (kept ≤ 25 h)      | **Optional**                                 | App functionality |

Not collected: Precise location, Personal info (name, email, user IDs tied to a person,
address, phone, etc.), Financial info, Health and fitness, Messages, Photos and videos,
Audio, Files and docs, Calendar, Contacts, App activity, Web browsing, App info and
performance, Other.

Notes for the form:

- "Shared" means transferred to a third party. Data sent to Supabase as our processor
  is not "sharing" under Play's definition.
- The random id is declared under "Device or other IDs" (an identifier for an app
  installation), not "User IDs" (which Play defines as identifying a person).
- **Permissions declared** (from `app.config.ts` / expo-location): `ACCESS_COARSE_LOCATION`,
  `ACCESS_FINE_LOCATION` (foreground only; the position is reduced to ~460 m on device).
  `ACCESS_BACKGROUND_LOCATION` is explicitly blocked, so no background-location
  declaration is needed.
- **Ads:** No. **Target audience:** 16+ (see store-listing.md).

---

## Other store questionnaires

- **Account deletion (Apple 5.1.1(v), Play account deletion policy):** not applicable,
  the app has no accounts. "Delete my data now" covers the anonymous id anyway.
- **Export compliance (Apple):** uses only standard HTTPS; `ITSAppUsesNonExemptEncryption = false`.
- **Third-party SDKs that collect data:** none (no analytics, ads or crash SDKs).
