// Live position of the current adhkar clip. Polls only while `active` and
// playing; reads once otherwise.
import {useCallback, useEffect, useState} from 'react';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {
  getAdhkarPlaybackPosition,
  seekAdhkarPlayback,
} from '@/services/adhkar/playback/adhkarPlaybackEngine';

const POLL_MS = 250;

export function useAdhkarProgress(active: boolean): {
  currentTime: number;
  duration: number;
  seek: (progress: number) => void;
} {
  const playing = useAdhkarSessionStore(s => s.session?.status === 'playing');
  const [position, setPosition] = useState({currentTime: 0, duration: 0});

  useEffect(() => {
    if (!active) {
      setPosition({currentTime: 0, duration: 0});
      return;
    }
    setPosition(getAdhkarPlaybackPosition());
    if (!playing) return;
    const id = setInterval(
      () => setPosition(getAdhkarPlaybackPosition()),
      POLL_MS,
    );
    return () => clearInterval(id);
  }, [active, playing]);

  const seek = useCallback(
    (progress: number) => {
      if (position.duration > 0)
        seekAdhkarPlayback(progress * position.duration);
    },
    [position.duration],
  );

  return {...position, seek};
}
