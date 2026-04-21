import {useEffect, useRef} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTimestampStore} from '@/store/timestampStore';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {binarySearchAyah} from '@/utils/timestampUtils';

export function useAyahTracker() {
  const playbackState = usePlayerStore(s => s.playback.state);
  const hasTimestamps = useTimestampStore(
    s => s.currentSurahTimestamps !== null,
  );
  const followAlongEnabled = useTimestampStore(s => s.followAlongEnabled);
  const lastAyahRef = useRef<number | null>(null);

  useEffect(() => {
    if (playbackState !== 'playing' || !hasTimestamps || !followAlongEnabled) {
      return;
    }

    const interval = setInterval(() => {
      const timestamps = useTimestampStore.getState().currentSurahTimestamps;
      if (!timestamps) return;

      const positionSec = expoAudioService.getCurrentTime(); // seconds (sync)
      const positionMs = positionSec * 1000;

      const ayah = binarySearchAyah(timestamps, positionMs);

      if (!ayah) {
        if (lastAyahRef.current !== null) {
          lastAyahRef.current = null;
          useTimestampStore.getState().clearCurrentAyah();
        }
        return;
      }

      if (ayah.ayahNumber !== lastAyahRef.current) {
        lastAyahRef.current = ayah.ayahNumber;
        useTimestampStore.getState().setCurrentAyah({
          surahNumber: ayah.surahNumber,
          ayahNumber: ayah.ayahNumber,
          verseKey: `${ayah.surahNumber}:${ayah.ayahNumber}`,
          timestampFrom: ayah.timestampFrom,
          timestampTo: ayah.timestampTo,
        });
      }
    }, 200);

    return () => {
      clearInterval(interval);
      lastAyahRef.current = null;
    };
  }, [playbackState, hasTimestamps, followAlongEnabled]);
}
