import { K_ANONYMITY } from '@shared/levels.ts';

import type { UsualPoint } from './types';

/** ISO weekday names, index 0 = Monday. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAYS_LONG = [
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
  'Sundays',
] as const;

/** ISO weekday (1 = Monday ... 7 = Sunday) of a local date. */
export function isoDay(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Weekday (ISO) and hour right now in a time zone, so a place's "usually"
 * chart is read in its own local time. Falls back to the phone's clock.
 */
export function clockIn(
  timeZone: string | null | undefined,
  now = new Date(),
): {
  day: number;
  hour: number;
} {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(now);
      const day = WEEKDAY_INDEX[parts.find((p) => p.type === 'weekday')?.value ?? ''];
      const hour = Number(parts.find((p) => p.type === 'hour')?.value);
      if (day && Number.isInteger(hour)) return { day, hour };
    } catch {
      // Unknown zone or no time-zone data: use the phone's clock.
    }
  }
  return { day: isoDay(now), hour: now.getHours() };
}

/** The phone's own IANA time zone, or null. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Typical devices for each hour of one weekday, 24 values. Missing hours are 0. */
export function dayBars(hours: readonly UsualPoint[], day: number): number[] {
  const bars = new Array<number>(24).fill(0);
  for (const p of hours) if (p.d === day && p.h >= 0 && p.h < 24) bars[p.h] = p.v;
  return bars;
}

/** Busiest hour of a day, or null when the day never clears k. */
export function peakHour(bars: readonly number[]): { hour: number; value: number } | null {
  let best = -1;
  let value = 0;
  bars.forEach((v, h) => {
    if (v > value) {
      value = v;
      best = h;
    }
  });
  return best < 0 || value < K_ANONYMITY ? null : { hour: best, value };
}

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** One readable line about a day, also used as the chart's accessibility label. */
export function daySummary(bars: readonly number[], day: number): string {
  const peak = peakHour(bars);
  const name = WEEKDAYS_LONG[day - 1] ?? 'This day';
  if (!peak) return `${name}: usually quiet all day`;
  return `${name}: usually busiest around ${hh(peak.hour)}`;
}

export type NowVsUsual = 'busier' | 'usual' | 'quieter';

/**
 * Right now compared with a typical moment at this hour. Only answered when
 * both sides are meaningful (the usual value clears k).
 */
export function nowVsUsual(now: number | null, usual: number): NowVsUsual | null {
  if (now === null || usual < K_ANONYMITY) return null;
  if (now > usual * 1.3) return 'busier';
  if (now < usual * 0.7) return 'quieter';
  return 'usual';
}
