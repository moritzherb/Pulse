import { latLngToCell } from 'h3-js';

import { cellCenter } from '@/lib/h3';

describe('cellCenter', () => {
  it('returns the centre in [lng, lat] order near the input point', () => {
    const [lng, lat] = cellCenter(latLngToCell(48.2082, 16.3738, 8));
    expect(lng).toBeCloseTo(16.37, 1);
    expect(lat).toBeCloseTo(48.21, 1);
  });
});
