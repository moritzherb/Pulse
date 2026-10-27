import { CITIES, nearestCity, searchCities } from '@/data/cities';

describe('cities', () => {
  it('has the design list with Vienna first', () => {
    expect(CITIES).toHaveLength(45);
    expect(CITIES[0]?.name).toBe('Vienna');
  });

  it('puts prefix matches first', () => {
    expect(searchCities('vi')[0]?.name).toBe('Vienna');
    expect(searchCities('austria').map((c) => c.name)).toEqual(['Vienna', 'Graz', 'Salzburg']);
    expect(searchCities('   ')).toEqual([]);
  });

  it('finds the nearest city', () => {
    expect(nearestCity(48.2, 16.37).name).toBe('Vienna');
    expect(nearestCity(47.07, 15.44).name).toBe('Graz');
  });
});
