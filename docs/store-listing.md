# Store listing

Copy for App Store Connect and Google Play. Lengths are checked against each store's
limit. `{{APP_NAME}}` is still open (see the name notes at the end); "Pulse" is the
working name.

## App Store (iOS)

| Field              | Limit | Text                                                                                                                                    |
| ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Name               | 30    | `{{APP_NAME}}`                                                                                                                          |
| Subtitle           | 30    | How busy is it right now?                                                                                                               |
| Promotional text   | 170   | See how busy Vienna’s squares, markets and bars are right now. Anonymous by design: places with fewer than five people are never shown. |
| Keywords           | 100   | crowd,busy,crowded,live,heatmap,wien,vienna,nightlife,bars,cafes,places,anonymous,privacy,map,now                                       |
| Primary category   |       | Travel                                                                                                                                  |
| Secondary category |       | Navigation                                                                                                                              |
| Price              |       | Free, no in-app purchases                                                                                                               |
| Age rating         |       | 4+ (every questionnaire answer "None"; no user-generated content, no web access)                                                        |
| Privacy policy URL |       | `{{PRIVACY_POLICY_URL}}` (publish `docs/privacy-policy.md`)                                                                             |
| Support URL        |       | `{{SUPPORT_URL}}`                                                                                                                       |

### Description

> See how busy a place is before you go.
>
> {{APP_NAME}} shows a live heatmap of how crowded squares, markets, parks, bars and
> cafés are right now. Tap any place to see whether it is quiet, moderate, busy or
> packed, whether it is filling up or emptying, and when it is usually busiest.
>
> LOOK WITHOUT SHARING
> The whole map works without an account and without sharing anything.
>
> SHARE ANONYMOUSLY, IF YOU WANT
> If you choose to help, your phone works out which place it is at (a café, a park, a
> museum) and reports only that place, every few minutes while the app is open. Your
> exact position never leaves your phone, and homes are never places on the map.
> There is no account, no name, no email, no tracking and no ads.
>
> PRIVATE BY DESIGN
> • Places with fewer than five people are never shown, so nobody can be singled out.
> • Counts are rounded to five.
> • Reports are deleted after 20 minutes.
> • Your random ID changes every day.
> • Mark home or work as private: nothing is ever sent from there.
> • One tap deletes everything you sent.
> • "What my phone is sending" shows exactly what leaves your phone.
>
> MADE FOR READING AT A GLANCE
> Levels are shown with words and patterns as well as colour, the app supports Dynamic
> Type, VoiceOver, Increase Contrast and Reduce Motion, and it comes in light and dark.
>
> Map data © OpenStreetMap contributors.

(≈1,450 characters; limit 4,000.)

### What's new (first release)

> First release: live crowd levels for Vienna, anonymous sharing, and "usually busy at".

### App Review notes

> No login is required. The app has no accounts.
>
> **Location:** foreground only. The position is matched on the device against public
> place outlines (OpenStreetMap) and only the id of the place is sent, only after the
> user chooses "Share
> anonymously" on the first screen. "Just browse" works fully without location.
>
> **Crowd data:** the map shows a place only when at least five different devices
> reported from it in the last 15 minutes (k-anonymity). Outside the launch city, or at
> quiet times, the map honestly shows "Not enough people here yet". To see live data,
> search for "Vienna".
>
> **Delete my data:** Settings → "Delete my data now" (tap twice) deletes the anonymous
> identity and everything linked to it on the server.
>
> `{{ATTACH A SHORT SCREEN RECORDING}}` of a development build with the simulated feed,
> in case live data is sparse at review time.

## Google Play (Android)

| Field                 | Limit | Text                                                                                                                                                          |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App name              | 30    | `{{APP_NAME}}`                                                                                                                                                |
| Short description     | 80    | See how busy places are right now. No account, no tracking: anonymous by design.                                                                              |
| Full description      | 4000  | Same as the App Store description above                                                                                                                       |
| Category              |       | Maps & Navigation                                                                                                                                             |
| Tags                  |       | Travel, Navigation, Local                                                                                                                                     |
| Contains ads          |       | No                                                                                                                                                            |
| In-app purchases      |       | No                                                                                                                                                            |
| Target audience       |       | 16 and over                                                                                                                                                   |
| Content rating (IARC) |       | Everyone. Answer "No" to "shares the user's current physical location with other users": only k-anonymous counts per place are shown, never anyone's location |
| App access            |       | All functionality is available without special access                                                                                                         |
| Privacy policy        |       | `{{PRIVACY_POLICY_URL}}`                                                                                                                                      |
| Data safety           |       | See `docs/store-privacy.md`                                                                                                                                   |

## Screenshots and graphics

Required before submission:

| Store       | Asset                             | Size                                  |
| ----------- | --------------------------------- | ------------------------------------- |
| App Store   | iPhone 6.9" screenshots (3 to 10) | 1320 × 2868 px (or 1290 × 2796)       |
| Google Play | Phone screenshots (2 to 8)        | 1080 × 1920 px or larger, 9:16        |
| Google Play | Feature graphic                   | 1024 × 500 px                         |
| Google Play | App icon                          | 512 × 512 px (from `assets/icon.png`) |

Suggested set, captured from a development build on an iPhone 16 Pro Max simulator with
the simulated feed on (or a staging project running `npm run seed -- --live`):

1. Map of central Vienna at street zoom, Busy / Packed places glowing, "Busiest now" open
2. Detail sheet for Naschmarkt with the Saturday "Usually" chart
3. Consent screen ("Before the map")
4. "What's sent" sheet
5. Settings with private areas and the rotating ID
6. The same map in dark mode

Screenshots from simulated data must not be presented as real-time data from a
specific moment; keep captions general ("See how busy places are right now").

## Name notes

From the earlier store search: "Pulze" exists as "Pulze – Blood Pressure Tracker" (App
Store, 2026) plus "My Pulze" and "Pulze Editor"; "Thrum" and "Teem" are taken; "Hubbub"
only appears as "the hubbub" (an NYC transit display); "Throng" had no store listing.
Reserve the final name in App Store Connect first; the store requires it to be unique.
The display name is one constant in `app.config.ts`; the bundle id
`com.moritzherb.pulse` does not need to match it.
