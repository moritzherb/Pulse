import { classify, overpassQuery, parseOverpass, VIENNA_BBOX, type OsmElement } from '../classify';

// Hand-written fixture in Overpass `out center tags` shape (not real OSM ids).
const fixture: { elements: OsmElement[] } = {
  elements: [
    { type: 'node', id: 1, lat: 48.21, lon: 16.37, tags: { amenity: 'bar', name: 'Bar Eins' } },
    {
      type: 'way',
      id: 2,
      center: { lat: 48.204, lon: 16.38 },
      tags: { leisure: 'park', name: 'Stadtpark', wikidata: 'Q1' },
    },
    { type: 'node', id: 3, lat: 48.2, lon: 16.36, tags: { tourism: 'museum', name: 'Museum X' } },
    {
      type: 'node',
      id: 4,
      lat: 48.2,
      lon: 16.36,
      tags: { amenity: 'cafe', name: 'Café', 'name:de': 'Kaffeehaus' },
    },
    {
      type: 'node',
      id: 5,
      lat: 48.2033,
      lon: 16.3527,
      tags: { place: 'neighbourhood', name: 'Spittelberg' },
    },
    {
      type: 'way',
      id: 6,
      center: { lat: 48.2082, lon: 16.3738 },
      tags: { place: 'square', name: 'Stephansplatz' },
    },
    { type: 'node', id: 7, lat: 48.2, lon: 16.36, tags: { amenity: 'bench' } },
    { type: 'node', id: 8, lat: 48.2, lon: 16.36, tags: { amenity: 'bar' } },
    { type: 'way', id: 9, tags: { amenity: 'bar', name: 'No position' } },
    { type: 'node', id: 1, lat: 48.21, lon: 16.37, tags: { amenity: 'bar', name: 'Bar Eins' } },
  ],
};

describe('OSM classification', () => {
  it('maps tags to categories, kinds and ranks', () => {
    expect(classify(fixture.elements[0]!).venue).toMatchObject({
      sourceId: 'node/1',
      category: 'nightlife',
      kind: 'bar',
      rank: 1,
    });
    expect(classify(fixture.elements[1]!).venue).toMatchObject({
      category: 'outdoors',
      kind: 'park',
      rank: 3,
      lat: 48.204,
      lng: 16.38,
    });
    expect(classify(fixture.elements[2]!).venue).toMatchObject({ category: 'sights', rank: 2 });
  });

  it('prefers the German name', () => {
    expect(classify(fixture.elements[3]!).venue?.name).toBe('Kaffeehaus');
  });

  it('turns neighbourhoods and squares into places', () => {
    expect(classify(fixture.elements[4]!).place).toMatchObject({
      name: 'Spittelberg',
      kind: 'area',
    });
    expect(classify(fixture.elements[5]!).place).toMatchObject({
      name: 'Stephansplatz',
      kind: 'landmark',
    });
  });

  it('skips untagged, unnamed, position-less and duplicate elements', () => {
    const { venues, places } = parseOverpass(fixture);
    expect(venues.map((v) => v.sourceId)).toEqual(['node/1', 'way/2', 'node/3', 'node/4']);
    expect(places).toHaveLength(2);
  });

  it('builds a bounded query', () => {
    const q = overpassQuery(VIENNA_BBOX);
    expect(q).toContain('48.118,16.182,48.323,16.578');
    expect(q).toContain('out center tags;');
    expect(q).toMatch(/amenity"~"\^\(bar\|pub/);
  });
});
