import {useEffect, useState} from 'react';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** "9:12 PM": 12-hour time without Intl, which not every TV runtime has. */
export function formatClockTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatWeekday(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

/** Milliseconds until the next minute starts (at least 1). */
export function msUntilNextMinute(date: Date): number {
  return Math.max(
    1,
    60000 - (date.getSeconds() * 1000 + date.getMilliseconds()),
  );
}

/** The current time, updated as each minute turns over. */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = (): void => {
      const next = new Date();
      setNow(next);
      timer = setTimeout(tick, msUntilNextMinute(next));
    };
    timer = setTimeout(tick, msUntilNextMinute(new Date()));
    return () => clearTimeout(timer);
  }, []);
  return now;
}
