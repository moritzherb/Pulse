import { dayBars, daySummary, isoDay, nowVsUsual, peakHour } from '@/features/detail/usual';

const hours = [
  { d: 6, h: 12, v: 18.5 },
  { d: 6, h: 13, v: 22 },
  { d: 6, h: 14, v: 9 },
  { d: 2, h: 3, v: 2.5 },
];

describe('usual-busyness helpers', () => {
  it('builds 24 bars for a weekday, missing hours as 0', () => {
    const bars = dayBars(hours, 6);
    expect(bars).toHaveLength(24);
    expect(bars[13]).toBe(22);
    expect(bars[0]).toBe(0);
  });

  it('finds the peak hour, but only above k', () => {
    expect(peakHour(dayBars(hours, 6))).toEqual({ hour: 13, value: 22 });
    expect(peakHour(dayBars(hours, 2))).toBeNull();
  });

  it('writes a one-line summary', () => {
    expect(daySummary(dayBars(hours, 6), 6)).toBe('Saturdays: usually busiest around 13:00');
    expect(daySummary(dayBars(hours, 2), 2)).toBe('Tuesdays: usually quiet all day');
  });

  it('compares now with usual only when both are meaningful', () => {
    expect(nowVsUsual(35, 20)).toBe('busier');
    expect(nowVsUsual(20, 20)).toBe('usual');
    expect(nowVsUsual(10, 20)).toBe('quieter');
    expect(nowVsUsual(null, 20)).toBeNull();
    expect(nowVsUsual(10, 3)).toBeNull();
  });

  it('uses ISO weekdays', () => {
    expect(isoDay(new Date(2026, 9, 25))).toBe(7); // Sunday
    expect(isoDay(new Date(2026, 9, 26))).toBe(1); // Monday
  });
});
