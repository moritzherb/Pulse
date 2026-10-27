import { useEffect, useState } from 'react';

/** Re-render every `intervalMs` and return the current time. */
export function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "12s ago", "3m ago", "never" (design wording). */
export function ago(ts: number | null, now = Date.now()): string {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}
