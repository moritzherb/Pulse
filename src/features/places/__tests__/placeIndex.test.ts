import { buildPlaceIndex, matchPlace, type ShapesPayload } from '../placeIndex';

const payload: ShapesPayload = {
  region: '851e15b7fffffff',
  // Café Central, a 12 m circle.
  circles: [[1, 16.3655, 48.2104, 12, 'Café Central']],
  polygons: [
    // A park around the café, and a museum building inside the park.
    [
      2,
      65000,
      [
        [
          [
            [16.36, 48.207],
            [16.37, 48.207],
            [16.37, 48.214],
            [16.36, 48.214],
            [16.36, 48.207],
          ],
        ],
      ],
      'Park',
    ],
    [
      3,
      2000,
      [
        [
          [
            [16.362, 48.208],
            [16.363, 48.208],
            [16.363, 48.209],
            [16.362, 48.209],
            [16.362, 48.208],
          ],
        ],
      ],
      'Museum',
    ],
  ],
};

describe('matchPlace', () => {
  const index = buildPlaceIndex(payload);

  it('finds the smallest place containing the position', () => {
    expect(matchPlace(index, [16.3655, 48.2104])?.name).toBe('Café Central');
    expect(matchPlace(index, [16.3625, 48.2085])?.name).toBe('Museum');
    expect(matchPlace(index, [16.368, 48.212])?.name).toBe('Park');
  });

  it('respects circle radius', () => {
    // ~15 m east of the café, still inside the park.
    expect(matchPlace(index, [16.3657, 48.2104])?.name).toBe('Park');
  });

  it('returns null outside every place', () => {
    expect(matchPlace(index, [16.4, 48.22])).toBeNull();
  });

  it('draws polygons at their centroid', () => {
    const museum = index.places.find((p) => p.id === 3)!;
    expect(museum.center[0]).toBeCloseTo(16.3625, 6);
    expect(museum.center[1]).toBeCloseTo(48.2085, 6);
  });
});
