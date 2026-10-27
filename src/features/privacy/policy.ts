/**
 * In-app privacy policy (design: Privacy screen). Every statement here must
 * match what the code does; docs/privacy-policy.md is the long form and the
 * store privacy answers are derived from the same facts (Phase 5).
 *
 * DRAFT: controller identity and contact are placeholders until provided.
 */
export const POLICY_SECTIONS: readonly { h: string; p: string }[] = [
  {
    h: 'Collected',
    p: 'Only while you share and the app is open: an H3 cell ID (resolution 8, an area of about 460 m), the time the server received it, and a random ID created on your phone. Nothing else: no coordinates, no device identifier, no account, no name or email.',
  },
  {
    h: 'On device',
    p: 'Your position is converted to a cell ID on your phone, then discarded. It is never transmitted or stored.',
  },
  {
    h: 'Private areas',
    p: 'You can mark places, such as home or work, that are never reported. A marked area covers roughly 250 m. The list stays on your phone and is never sent.',
  },
  {
    h: 'Retention',
    p: 'Individual reports are deleted after 20 minutes by a job that runs every minute. There is no location history of you.',
  },
  {
    h: 'Aggregation',
    p: 'The map counts different phones per cell over the last 15 minutes. Cells with fewer than five never leave the database. Counts are rounded to five.',
  },
  {
    h: 'Patterns',
    p: 'For “usually busy at”, the already-anonymous cell counts are averaged per hour and kept for 12 months. They cannot be linked to any phone.',
  },
  {
    h: 'Random ID',
    p: 'A new random ID replaces the old one every 24 hours, or when you tap Rotate. Unused IDs are deleted after 25 hours.',
  },
  {
    h: 'Legal basis',
    p: 'Your consent, Art. 6(1)(a) GDPR, given on the first screen and recorded with a timestamp and this policy version. Browsing the map needs no consent.',
  },
  {
    h: 'Withdrawal',
    p: 'Switch off sharing or tap Delete my data in Settings. Deletion is immediate and removes reports already sent, not only future ones.',
  },
  {
    h: 'Sharing',
    p: 'No data is sold or shared with third parties. Data is processed by our hosting provider (Supabase) under a data processing agreement.',
  },
  {
    h: 'Contact',
    p: 'Data controller and contact address will be listed here before release.',
  },
];
