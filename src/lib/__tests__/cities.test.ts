import { CITIES, DEFAULT_CITY, nearestCity, searchCities } from '@/data/cities';

describe('cities', () => {
  it('covers the world, largest first, starting the map in Vienna', () => {
    expect(CITIES.length).toBeGreaterThan(4000);
    expect(CITIES[0]!.population).toBeGreaterThanOrEqual(CITIES[1]!.population);
    expect(DEFAULT_CITY).toMatchObject({ name: 'Vienna', country: 'Austria' });
  });

  it('puts prefix matches first, largest first', () => {
    expect(searchCities('vie')[0]?.name).toBe('Vienna');
    expect(searchCities('new y')[0]?.name).toBe('New York City');
    expect(searchCities('   ')).toEqual([]);
  });

  it('ignores accents and finds countries', () => {
    expect(searchCities('zurich')[0]?.name).toBe('Zürich');
    expect(searchCities('sao p')[0]?.name).toBe('São Paulo');
    expect(searchCities('austria', 10).map((c) => c.name)).toEqual(
      expect.arrayContaining(['Vienna', 'Graz', 'Salzburg']),
    );
  });

  it('leaves out districts of cities', () => {
    expect(CITIES.some((c) => c.name === 'Favoriten')).toBe(false);
  });

  it('finds the nearest city anywhere', () => {
    expect(nearestCity(48.2, 16.37).name).toBe('Vienna');
    expect(nearestCity(47.07, 15.44).name).toBe('Graz');
    expect(nearestCity(-33.87, 151.21).name).toBe('Sydney');
  });
});
