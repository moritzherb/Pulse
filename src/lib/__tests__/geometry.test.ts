import {
  assembleRings,
  distanceM,
  pointInRing,
  ringAreaM2,
  ringCentroid,
  type Ring,
} from '@shared/geometry.ts';

// About 75 m x 111 m in Vienna.
const box: Ring = [
  [16.37, 48.2],
  [16.371, 48.2],
  [16.371, 48.201],
  [16.37, 48.201],
  [16.37, 48.2],
];

describe('place geometry', () => {
  it('measures distance and area in metres', () => {
    expect(distanceM([16.37, 48.2], [16.37, 48.201])).toBeCloseTo(110.5, 0);
    expect(ringAreaM2(box)).toBeGreaterThan(8_200);
    expect(ringAreaM2(box)).toBeLessThan(8_300);
    expect(ringAreaM2([...box].reverse())).toBeCloseTo(ringAreaM2(box));
  });

  it('finds the centroid', () => {
    const [lng, lat] = ringCentroid(box);
    expect(lng).toBeCloseTo(16.3705, 6);
    expect(lat).toBeCloseTo(48.2005, 6);
  });

  it('tests points against rings', () => {
    expect(pointInRing([16.3705, 48.2005], box)).toBe(true);
    expect(pointInRing([16.3715, 48.2005], box)).toBe(false);
  });

  it('joins ways into rings and rejects open ones', () => {
    const rings = assembleRings([
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    ]);
    expect(rings).toHaveLength(1);
    expect(rings![0]).toHaveLength(5);
    expect(
      assembleRings([
        [
          [0, 0],
          [1, 0],
        ],
      ]),
    ).toBeNull();
  });
});
