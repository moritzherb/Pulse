# Privacy Policy

**Pulse** · Version 2026-10-27

> **Before publishing**, replace every `{{PLACEHOLDER}}`:
> `{{APP_NAME}}`, `{{CONTROLLER_NAME}}`, `{{CONTROLLER_ADDRESS}}`, `{{PRIVACY_EMAIL}}`,
> `{{SUPERVISORY_AUTHORITY}}`, `{{SUPABASE_REGION}}`. Then publish this page at a public
> URL (App Store Connect and Google Play both require one) and keep it in sync with the
> in-app text in `src/features/privacy/policy.ts`. If you change what is processed,
> bump `EXPO_PUBLIC_POLICY_VERSION` so everyone sees the consent screen again.
>
> This draft describes exactly what the code in this repository does. It is not legal
> advice; have it reviewed before release.

## 1. Who is responsible

{{CONTROLLER_NAME}}, {{CONTROLLER_ADDRESS}} ("we") is the controller for the processing
described here. Contact for anything about your data: {{PRIVACY_EMAIL}}.

## 2. Pulse in one paragraph

Pulse shows how busy places are right now. You can look at the map without sharing
anything and without an account. If you choose to share, your phone tells our server
which roughly 460 m area it is in, every few minutes while the app is open. The server
only ever publishes how many different phones are in an area, and only when there are
at least five. Individual reports are deleted after 20 minutes.

## 3. What we process, why, and for how long

### 3.1 When you only look at the map (no sharing)

| Data                                                                                                                                                | Why                                                                                     | Legal basis                                                         | Kept                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Your IP address and technical request data (app version, time), and the map area you are viewing (as region or viewport coordinates in the request) | To deliver crowd data, venue names and the detail sheet, and to keep the service secure | Our legitimate interest in operating the service, Art. 6(1)(f) GDPR | In our hosting provider's request logs for a short period set by its log retention (days); we do not use them for anything else |
| Your phone's time zone (for example "Europe/Vienna")                                                                                                | To show "usually busy at" in your local hours                                           | Art. 6(1)(f) GDPR                                                   | Not stored                                                                                                                      |

Map tiles are loaded directly from **OpenFreeMap** (`tiles.openfreemap.org`). Like any
web request, this reveals your IP address and which map tiles (area and zoom level) you
are viewing to OpenFreeMap. We do not receive or control that data; see OpenFreeMap's
own privacy information.

No account, no email address, no name, no advertising identifier, no analytics, no
crash reporting, no tracking.

### 3.2 When you choose "Share anonymously"

| Data                                                                                                                                                | Why                                                                                   | Legal basis                     | Kept                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| An **area ID**: an H3 cell at resolution 8, an area of about 0.74 km² (edges of ~460 m), computed on your phone                                     | To count how many different phones are in each area                                   | Your consent, Art. 6(1)(a) GDPR | 20 minutes, then deleted automatically                                                                          |
| A **random ID** created for this purpose (an anonymous Supabase user). It is not derived from your phone, SIM, advertising ID or anything about you | To count each phone once per area, to rate-limit, and to let you delete what you sent | Art. 6(1)(a) GDPR               | Replaced after 24 hours or when you tap "Rotate my ID now"; deleted at the latest 25 hours after it was created |
| The **time** the server received a report                                                                                                           | Counting the last 15 minutes                                                          | Art. 6(1)(a) GDPR               | Deleted with the report (20 minutes)                                                                            |
| A **record of your consent** (purpose, yes/no, policy version, time)                                                                                | To be able to show that you agreed (Art. 7(1) GDPR)                                   | Art. 6(1)(c) GDPR               | Deleted together with the random ID (at most 25 hours)                                                          |
| Your IP address in the sign-in log of the random ID                                                                                                 | Security of the sign-in service                                                       | Art. 6(1)(f) GDPR               | Deleted after 25 hours                                                                                          |

**Your exact position never leaves your phone.** The app reads it, turns it into the
area ID on the phone, and discards it within milliseconds. It is never sent, stored or
logged.

**Private areas.** You can mark places (for example home or work, about 250 m around
the spot) from which nothing is ever sent. This list stays on your phone.

### 3.3 What is published

Every minute the server counts the different random IDs per area over the last
15 minutes. Areas with fewer than five are never published. Counts are rounded to the
nearest five. The published numbers, the trend, and an hourly average kept for
"usually busy at" are **anonymous**: they cannot be linked to you or to your random ID.
The hourly averages are kept for 12 months.

### 3.4 Venue and place names

Names and categories of bars, cafés, museums, parks and neighbourhoods come from
OpenStreetMap (© OpenStreetMap contributors, ODbL). They are public data and do not
relate to you.

## 4. On your phone

Pulse stores on your phone, inside its own app storage: your consent choice, your
appearance setting, your private areas, and the session of your random ID. Nothing is
stored in the iOS Keychain, so uninstalling the app removes all of it. This storage is
strictly necessary for the functions you use.

## 5. Recipients and processors

- **Supabase** (database, server functions, sign-in for the random ID), hosted in
  {{SUPABASE_REGION}}, under a data processing agreement. Where Supabase or its
  sub-processors access data from outside the EU/EEA, this is covered by the EU
  Standard Contractual Clauses.
- **OpenFreeMap** receives map tile requests directly from your phone (see 3.1).
- **Apple / Google** distribute the app; their own terms apply to the stores.

We do not sell or share data with anyone else, and we do not use it for advertising.

## 6. Your rights

You can, at any time and free of charge:

- **Withdraw consent**: switch off "Share my area" in Settings. Reports already sent are
  deleted immediately, not only future ones.
- **Erase your data**: "Delete my data now" in Settings deletes your random ID and
  everything linked to it on our server, and resets the app.
- **Access, rectification, restriction, objection, portability** (Art. 15–21 GDPR):
  write to {{PRIVACY_EMAIL}}. Settings shows your current random ID; include it so we can
  find the (at most 20 minutes of) data linked to it.
- **Complain** to a supervisory authority, in particular {{SUPERVISORY_AUTHORITY}}.

Because the random ID is replaced every 24 hours and reports are deleted after
20 minutes, there is usually very little or nothing left to access.

## 7. Security

All connections are encrypted (HTTPS/TLS). Raw reports can only be written by a server
function and can never be read by any app or user; database access is restricted by
row-level security on every table. Deletion of reports (every minute) and of old IDs
and sign-in logs (every hour) is automatic.

## 8. Children

Pulse is not directed at children under 16. Sharing requires an active choice on the
first screen.

## 9. No automated decisions

We make no decisions about you based on automated processing, and we build no
profiles.

## 10. Changes

We change this policy only when what Pulse does changes. When we do, the version above
changes and the app asks for your choice again before anything more is sent.
