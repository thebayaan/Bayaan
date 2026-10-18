import {useEffect, useState} from 'react';
import {useTVPlayerStore} from '../../store/tvPlayerStore';

/**
 * Milliseconds left on a running sleep timer, ticking every second, or
 * undefined when no timer runs ("end of surah" has no countdown).
 */
export function useSleepLeftMs(): number | undefined {
  const sleep = useTVPlayerStore(s => s.sleep);
  const endsAt = sleep.kind === 'timer' ? sleep.endsAt : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt === null ? undefined : Math.max(0, endsAt - now);
}
