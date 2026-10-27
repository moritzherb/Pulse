# Design notes

How the native app relates to the Claude Design prototype (`design/Pulse.dc.html`),
what was filled in where the design is silent, and what the app does for accessibility.
Every fill-in is also marked `fill-in` in the source.

## Taken from the design as is

- Colours, type scale, spacing, radii, shadows and motion timings: `src/theme/tokens.ts`,
  `src/theme/typography.ts` (values copied from the HTML; CSS `box-shadow` and gradients
  are rendered natively by React Native 0.88).
- Screens: consent (variant A), map, Settings, Privacy, "What's sent". Layout, copy
  and component styles follow the prototype.
- Map: the blurred heatmap and its density ramp, the hex treatment, search, chips,
  sharing pill, compass, locate, "Busiest now" card (list variant A), empty state, toast.
- Icons: the design's CSS rings, dot and triangle, redrawn in SVG. No icon library, no emoji.

## Decisions that change the design

| Change                                                              | Why                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Consent lists one purpose (location); analytics and updates removed | The app does neither; the store privacy labels must match the code                       |
| Consent screen drops the "Each one separate" toggle block           | With one purpose it repeated the two buttons; the switch remains in Settings             |
| "A 460 m area" instead of "a 460 m area and a category"             | Category is derived on the server from OpenStreetMap, never sent by the phone            |
| Basemap: OpenFreeMap Positron (vector) instead of CARTO raster      | Same cartography; CARTO needs a paid licence for commercial apps                         |
| Blur at city zoom, hexagons from zoom 13                            | Hexagons carry level patterns and the pulse; the blur keeps the design's look zoomed out |

## Fill-ins (not in the design, built in its style)

| What                                                                                                             | Where                                         |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Dark mode palette and dark basemap (Positron recoloured on device)                                               | `tokens.ts`, `features/map/mapStyle.ts`       |
| Appearance setting: System / Light / Dark                                                                        | Settings                                      |
| Four named levels (Quiet, Moderate, Busy, Packed) with patterns: none, dots, lines, cross-hatch                  | `tokens.ts`, `LevelSwatch`, map pattern tiles |
| Level word on every "Busiest now" row; tappable legend that reveals the pattern key                              | `BusiestSheet`                                |
| Pulse of Busy / Packed cells and of the city heatmap                                                             | `HeatLayers`                                  |
| Cross-fade when a cell changes level; list rows glide to their new rank                                          | `levelCrossfade.ts`, `BusiestSheet`           |
| Cell / venue detail sheet, "usually busy at" chart, now-vs-usual line                                            | `components/detail/`                          |
| Venue pins (hollow rings) with names from zoom 15.5                                                              | `VenueLayer`                                  |
| Offline state ("Can't reach Pulse right now")                                                                    | `EmptyState`                                  |
| Delete my data asks for a second tap within 5 s                                                                  | Settings                                      |
| Onboarding entrance (blocks rise 8 pt, 70 ms apart)                                                              | `onboarding.tsx`                              |
| Locate button breathes while it searches                                                                         | `MapControls`, `Breathe`                      |
| High-contrast palette for Increase Contrast / High contrast text                                                 | `tokens.ts`                                   |
| App icon and splash: the design's ring, an outer pulse ring in its border grey, one dot in the ramp's packed red | `assets/`                                     |
| About line (version, OpenStreetMap / OpenFreeMap credits)                                                        | Settings                                      |

## Accessibility

- **Not colour alone**: every level has a word and a pattern; the list and the detail sheet
  say the level, the approximate count and the trend in words.
- **VoiceOver / TalkBack**: all controls have roles, labels, states (selected, checked,
  expanded) and hints. Icon-only buttons are labelled. Toasts and the detail sheet are
  announced. The map is one labelled element that points to the list, which is its
  accessible equivalent. The weekly chart reads as one sentence ("Saturdays: usually
  busiest around 13:00").
- **Dynamic Type**: reading text scales up to 2x; text inside fixed-shape controls is capped
  at 1.35x so controls stay usable. Controls grow with their text (minimum heights, not
  fixed heights).
- **Contrast**: the design's light-mode muted grey (#8a8a8c) is 3.5:1 on white, under WCAG
  AA for small text. It is kept as designed by default; with Increase Contrast (iOS) or
  High contrast text (Android) the app switches to a palette that meets 4.5:1 for every
  reading colour (unit-tested in `src/theme/__tests__/contrast.test.ts`). The dark theme
  meets 4.5:1 by default.
- **Reduce Motion**: no pulses, no cross-fades, no entrance animations, and camera moves
  jump instead of fly.
- **Touch targets**: 44 pt minimum, or hit slop on small text actions.
- **Haptics**: light selection feedback on switches, chips, tabs and options; a warning
  before deletion. Never the only feedback.
