/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import { LEVEL_MIN_DEVICES } from '@shared/levels.ts';

/** The SQL level_for() and the shared TypeScript thresholds must never drift apart. */
it('SQL level_for() matches LEVEL_MIN_DEVICES', () => {
  const sql = readFileSync(
    join(__dirname, '../../../supabase/migrations/20261027120000_core_schema.sql'),
    'utf8',
  );
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
