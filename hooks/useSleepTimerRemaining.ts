// @ai-generated
import {useEffect, useState} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';

/**
 * Minutes left on the sleep timer, or null when it is off. Under a minute it
 * is fractional so callers can show seconds. Ticks every half second while a
 * timer runs.
 */
export function useSleepTimerRemaining(): number | null {
  const sleepTimerEnd = usePlayerStore(s => s.settings.sleepTimerEnd);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!sleepTimerEnd) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const left = sleepTimerEnd - Date.now();
      if (left <= 0) setRemaining(null);
      else if (left < 60 * 1000) setRemaining(Math.ceil(left / 1000) / 60);
      else setRemaining(Math.ceil(left / (60 * 1000)));
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [sleepTimerEnd]);

  return remaining;
}
