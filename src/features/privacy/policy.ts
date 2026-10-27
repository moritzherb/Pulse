/**
 * In-app privacy policy (design: Privacy screen). The short form of
 * docs/privacy-policy.md; both must describe exactly what the code does. The
 * store privacy answers (docs/store-privacy.md) are derived from the same facts.
 *
 * Controller identity and contact are placeholders until provided (see the
 * checklist at the top of docs/privacy-policy.md).
 */
export const POLICY_SECTIONS: readonly { h: string; p: string }[] = [
  {
    h: 'Looking',
    p: 'Browsing the map needs no account and no consent. Like any app that loads data, your IP address and the map area you view reach our hosting provider (Supabase) and the map tile service (OpenFreeMap). No analytics, no ads, no tracking.',
  },
  {
    h: 'Sharing',
    p: 'Only if you choose to share, and only while the app is open: an area ID (an H3 cell of about 460 m), a random ID made for this, and the time the server received it. Nothing else.',
  },
  {
    h: 'On device',
    p: 'Your position is turned into the area ID on your phone, then discarded. It is never sent, stored or logged.',
  },
  {
    h: 'Private areas',
    p: 'Places you mark, such as home or work (about 250 m), are never reported. The list stays on your phone.',
  },
  {
    h: 'Retention',
    p: 'Reports: 20 minutes. Random ID, its consent record and its sign-in log: replaced after 24 hours, deleted after at most 25. Hourly averages for “usually busy at”: 12 months, anonymous.',
  },
  {
    h: 'Aggregation',
    p: 'The map counts different phones per area over 15 minutes. Areas with fewer than five never leave the database. Counts are rounded to five.',
  },
  {
    h: 'Legal basis',
    p: 'Sharing: your consent, Art. 6(1)(a) GDPR, recorded with this policy version. Browsing: our legitimate interest in running the service, Art. 6(1)(f).',
  },
  {
    h: 'Your rights',
    p: 'Switch off sharing to withdraw consent; what was sent is deleted at once. Delete my data removes everything linked to your random ID. You may also ask for access, object, or complain to a data protection authority.',
  },
  {
    h: 'Processors',
    p: 'Supabase (database, EU region) under a data processing agreement. OpenFreeMap serves map tiles. Venue names © OpenStreetMap contributors. Nothing is sold or shared for advertising.',
  },
  {
    h: 'Contact',
    p: 'Data controller and contact address will be listed here before release.',
  },
];
