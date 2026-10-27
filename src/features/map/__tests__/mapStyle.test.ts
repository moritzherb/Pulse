import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { parseColor, toDark } from '@/features/map/mapStyle';

describe('parseColor', () => {
  it('parses the formats Positron uses', () => {
    expect(parseColor('#fff')).toEqual([0, 0, 1, 1]);
    expect(parseColor('#000000')?.[2]).toBe(0);
    expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual([0, 1, 0.5, 0.5]);
    expect(parseColor('hsl(210, 50%, 40%)')).toEqual([210, 0.5, 0.4, 1]);
    expect(parseColor('hsla(30,10%,90%,0.3)')).toEqual([30, 0.1, 0.9, 0.3]);
  });

  it('ignores non-colours', () => {
    expect(parseColor('motorway')).toBeNull();
    expect(parseColor('#zzz')).toBeNull();
  });
});

describe('toDark', () => {
  const light = {
    version: 8,
    sources: {},
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': 'rgb(242,243,240)' } },
      {
        id: 'water',
        type: 'fill',
        source: 'x',
        'source-layer': 'water',
        paint: { 'fill-color': '#c2c8ca' },
      },
      {
        id: 'road',
        type: 'line',
        source: 'x',
        'source-layer': 'transportation',
        paint: {
          'line-color': ['interpolate', ['linear'], ['zoom'], 10, '#ffffff', 16, 'hsl(0,0%,95%)'],
        },
      },
      {
        id: 'label',
        type: 'symbol',
        source: 'x',
        'source-layer': 'place',
        paint: { 'text-color': 'hsl(0,0%,40%)', 'text-halo-color': '#ffffff' },
      },
    ],
  } as unknown as StyleSpecification;

  const dark = toDark(light);
  const paint = (i: number) => (dark.layers[i] as { paint: Record<string, unknown> }).paint;
  const lightness = (c: unknown) => parseColor(c as string)?.[2] ?? -1;

  it('replaces the background with the dark token', () => {
    expect(paint(0)['background-color']).toBe('#111113');
  });

  it('turns light fills and lines dark, including inside expressions', () => {
    expect(lightness(paint(1)['fill-color'])).toBeLessThan(0.3);
    const expr = paint(2)['line-color'] as unknown[];
    expect(expr.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
    expect(lightness(expr[4])).toBeLessThan(0.3);
    expect(lightness(expr[6])).toBeLessThan(0.3);
  });

  it('keeps labels light on a dark halo', () => {
    expect(lightness(paint(3)['text-color'])).toBeGreaterThanOrEqual(0.5);
    expect(lightness(paint(3)['text-halo-color'])).toBeLessThan(0.1);
  });

  it('does not mutate the input', () => {
    expect((light.layers[1] as { paint: Record<string, unknown> }).paint['fill-color']).toBe(
      '#c2c8ca',
    );
  });
});
