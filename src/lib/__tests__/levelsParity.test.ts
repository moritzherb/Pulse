/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import { LEVEL_MIN_DEVICES, MIN_USUAL_PEAK, PEAK_SHARE } from '@shared/levels.ts';

const migration = (name: string) =>
  readFileSync(join(__dirname, '../../../supabase/migrations', name), 'utf8');

/** The SQL level functions and the shared TypeScript thresholds must never drift apart. */
it('SQL level_for() matches LEVEL_MIN_DEVICES', () => {
  const sql = migration('20261027120000_core_schema.sql');
  const found = [...sql.matchAll(/when devices >= (\d+) then (\d)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  expect(found).toEqual([
    [LEVEL_MIN_DEVICES.packed, 4],
    [LEVEL_MIN_DEVICES.busy, 3],
    [LEVEL_MIN_DEVICES.moderate, 2],
  ]);
});

it('SQL level_for_place() matches PEAK_SHARE and MIN_USUAL_PEAK', () => {
  const sql = migration('20261028120000_places.sql');
  const shares = [...sql.matchAll(/when devices >= usual_peak \* ([\d.]+) then (\d)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  expect(shares).toEqual([
    [PEAK_SHARE.packed, 4],
    [PEAK_SHARE.busy, 3],
    [PEAK_SHARE.moderate, 2],
  ]);
  expect(sql).toContain(`usual_peak < ${MIN_USUAL_PEAK} then public.level_for(devices)`);
});
