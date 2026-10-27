import {
  classify,
  overpassQuery,
  parseOverpass,
  shapeWkt,
  VIENNA_BBOX,
  type OsmElement,
} from '../../supabase/functions/_shared/osm/classify.ts';

/** A closed square way around a point, in Overpass `out geom` shape. */
const square = (lat: number, lon: number, d = 0.0005) => [
  { lat, lon },
  { lat, lon: lon + d },
  { lat: lat + d, lon: lon + d },
  { lat: lat + d, lon },
  { lat, lon },
];

// Hand-written fixture in Overpass `out geom tags` shape (not real OSM ids).
const fixture: { elements: OsmElement[] } = {
  elements: [
    { type: 'node', id: 1, lat: 48.21, lon: 16.37, tags: { amenity: 'bar', name: 'Bar Eins' } },
    {
      type: 'way',
      id: 2,
      geometry: square(48.204, 16.38, 0.003),
      bounds: { minlat: 48.204, minlon: 16.38, maxlat: 48.207, maxlon: 16.383 },
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
      geometry: square(48.2082, 16.3738),
      tags: { place: 'square', name: 'Stephansplatz' },
    },
    { type: 'node', id: 7, lat: 48.2, lon: 16.36, tags: { amenity: 'bench' } },
    { type: 'node', id: 8, lat: 48.2, lon: 16.36, tags: { amenity: 'bar' } },
    { type: 'way', id: 9, tags: { amenity: 'bar', name: 'No position' } },
    { type: 'node', id: 1, lat: 48.21, lon: 16.37, tags: { amenity: 'bar', name: 'Bar Eins' } },
    // A pedestrian street mapped as an open way: becomes a circle over its bounds.
    {
      type: 'way',
      id: 10,
      geometry: [
        { lat: 48.2, lon: 16.35 },
        { lat: 48.2, lon: 16.352 },
      ],
      bounds: { minlat: 48.2, minlon: 16.35, maxlat: 48.2, maxlon: 16.352 },
      tags: { amenity: 'marketplace', name: 'Markt' },
    },
    // A multipolygon whose outer ring is split over two ways, one reversed.
    {
      type: 'relation',
      id: 11,
      members: [
        {
          type: 'way',
          role: 'outer',
          geometry: [
            { lat: 48.21, lon: 16.36 },
            { lat: 48.21, lon: 16.362 },
            { lat: 48.212, lon: 16.362 },
          ],
        },
        {
          type: 'way',
          role: 'outer',
          geometry: [
            { lat: 48.21, lon: 16.36 },
            { lat: 48.212, lon: 16.36 },
            { lat: 48.212, lon: 16.362 },
          ],
        },
      ],
      tags: { leisure: 'park', name: 'Volksgarten' },
    },
    {
      type: 'node',
      id: 12,
      lat: 48.2085,
      lon: 16.3731,
      tags: { amenity: 'place_of_worship', name: 'Stephansdom', wikidata: 'Q2' },
    },
    {
      type: 'node',
      id: 13,
      lat: 48.2,
      lon: 16.37,
      tags: { amenity: 'place_of_worship', name: 'Kapelle' },
    },
  ],
};

const el = (id: number) => fixture.elements.find((e) => e.id === id)!;

describe('OSM classification', () => {
  it('maps tags to categories, kinds and ranks', () => {
    expect(classify(el(1)).venue).toMatchObject({
      sourceId: 'node/1',
      category: 'nightlife',
      kind: 'bar',
      rank: 1,
    });
    expect(classify(el(2)).venue).toMatchObject({ category: 'outdoors', kind: 'park', rank: 3 });
    expect(classify(el(3)).venue).toMatchObject({ category: 'sights', rank: 2 });
  });

  it('gives points a circle sized for their kind', () => {
    const bar = classify(el(1)).venue!;
    expect(bar.shape).toEqual({ type: 'circle', radiusM: 15 });
    expect(bar.areaM2).toBeCloseTo(Math.PI * 225);
  });

  it('keeps mapped outlines, measured, with the centroid as position', () => {
    const park = classify(el(2)).venue!;
    expect(park.shape.type).toBe('polygon');
    // 0.003° x 0.003° in Vienna is about 223 m x 332 m.
    expect(park.areaM2).toBeGreaterThan(70_000);
    expect(park.areaM2).toBeLessThan(76_000);
    expect(park.lat).toBeCloseTo(48.2055, 4);
    expect(park.lng).toBeCloseTo(16.3815, 4);
  });

  it('joins split multipolygon rings', () => {
    const v = classify(el(11)).venue!;
    expect(v.shape.type).toBe('polygon');
    expect(v.shape.type === 'polygon' && v.shape.rings).toHaveLength(1);
  });

  it('turns open ways into a circle over their extent', () => {
    expect(classify(el(10)).venue?.shape).toEqual({ type: 'circle', radiusM: 74 });
  });

  it('counts notable churches only', () => {
    expect(classify(el(12)).venue).toMatchObject({ kind: 'church', category: 'sights' });
    expect(classify(el(13)).venue).toBeUndefined();
  });

  it('prefers the German name', () => {
    expect(classify(el(4)).venue?.name).toBe('Kaffeehaus');
  });

  it('turns neighbourhoods into places, and squares into both', () => {
    expect(classify(el(5))).toEqual({
      place: { sourceId: 'node/5', name: 'Spittelberg', kind: 'area', lat: 48.2033, lng: 16.3527 },
    });
    const stephansplatz = classify(el(6));
    expect(stephansplatz.place).toMatchObject({ name: 'Stephansplatz', kind: 'landmark' });
    expect(stephansplatz.venue).toMatchObject({ kind: 'square', category: 'sights' });
  });

  it('skips untagged, unnamed, position-less and duplicate elements', () => {
    const { venues, places } = parseOverpass(fixture);
    expect(venues.map((v) => v.sourceId)).toEqual([
      'node/1',
      'way/2',
      'node/3',
      'node/4',
      'way/6',
      'way/10',
      'relation/11',
      'node/12',
    ]);
    expect(places).toHaveLength(2);
  });

  it('writes outlines as EWKT multipolygons and circles as null', () => {
    expect(shapeWkt(classify(el(6)).venue!.shape)).toMatch(
      /^SRID=4326;MULTIPOLYGON\(\(\(16\.3738 48\.2082,/,
    );
    expect(shapeWkt(classify(el(1)).venue!.shape)).toBeNull();
  });

  it('builds a bounded query that returns outlines', () => {
    const q = overpassQuery(VIENNA_BBOX);
    expect(q).toContain('48.118,16.182,48.323,16.578');
    expect(q).toContain('out geom tags;');
    expect(q).toMatch(/amenity"~"\^\(bar\|pub/);
  });
});
