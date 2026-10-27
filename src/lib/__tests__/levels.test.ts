import {
  K_ANONYMITY,
  LEVEL_MIN_DEVICES,
  levelForDevices,
  levelForPlace,
  levelFromRank,
} from '@shared/levels.ts';

describe('levelForDevices', () => {
  it('maps the documented thresholds', () => {
    expect(levelForDevices(5)).toBe('quiet');
    expect(levelForDevices(9)).toBe('quiet');
    expect(levelForDevices(10)).toBe('moderate');
    expect(levelForDevices(19)).toBe('moderate');
    expect(levelForDevices(20)).toBe('busy');
    expect(levelForDevices(34)).toBe('busy');
    expect(levelForDevices(35)).toBe('packed');
    expect(levelForDevices(500)).toBe('packed');
  });

  it('starts at the k-anonymity floor', () => {
    expect(K_ANONYMITY).toBe(5);
    expect(LEVEL_MIN_DEVICES.quiet).toBe(K_ANONYMITY);
  });

  it('round-trips server ranks 1..4', () => {
    expect([1, 2, 3, 4].map(levelFromRank)).toEqual(['quiet', 'moderate', 'busy', 'packed']);
    expect(levelFromRank(0)).toBe('quiet');
    expect(levelFromRank(9)).toBe('packed');
  });
});

describe('levelForPlace', () => {
  it('judges a place against its own usual peak', () => {
    expect(levelForPlace(30, 100)).toBe('quiet');
    expect(levelForPlace(35, 100)).toBe('moderate');
    expect(levelForPlace(60, 100)).toBe('busy');
    expect(levelForPlace(85, 100)).toBe('packed');
    // A small café is packed at a count a park would call quiet.
    expect(levelForPlace(15, 15)).toBe('packed');
  });

  it('falls back to fixed thresholds without enough history', () => {
    expect(levelForPlace(25, null)).toBe(levelForDevices(25));
    expect(levelForPlace(25, 8)).toBe(levelForDevices(25));
  });
});
