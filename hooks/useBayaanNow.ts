// @ai-generated
// The Home tab's Bayaan Now cards for this moment. Reads the same inputs as
// CarPlay's "For right now" (the reciter of the last thing played, else the
// default reciter) and refreshes when the hour's rules change, when the app
// comes back, and when something new is played.
import {useEffect, useMemo, useState} from 'react';
import {AppState} from 'react-native';
import {RECITERS} from '@/data/reciterData';
import {getSystemPlaylists} from '@/data/systemPlaylists';
import {isFeatureEnabled} from '@/config/featureFlags';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useReciterStore} from '@/store/reciterStore';
import {
  availableSurahIds,
  findRewayat,
} from '@/services/car/snapshot/buildCarSnapshot';
import {
  bayaanNowMoments,
  nextMomentChange,
  type NowLastPlayed,
  type NowMoment,
  type NowReciter,
} from '@/services/bayaanNow/moments';
import {useBayaanNowOccasion} from '@/hooks/useBayaanNowOccasion';
import {activeSlots} from '@/services/bayaanNow/occasion';
import {useCatalogVersion} from '@/components/home/homeKit';

const COMPLETED = 0.95;
/** The sun and moon move along the sky, and occasions start and end. */
const TICK_MS = 10 * 60 * 1000;

/** The current time, moved on at each boundary the rules use, and every ten minutes. */
function useMomentClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const untilBoundary = nextMomentChange(now).getTime() - Date.now() + 500;
    const wait = Math.max(1000, Math.min(untilBoundary, TICK_MS));
    const timer = setTimeout(() => setNow(new Date()), wait);
    return () => clearTimeout(timer);
  }, [now]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      setNow(prev => {
        const fresh = new Date();
        // Only re-render when time moved on while the app was away.
        return fresh.getTime() - prev.getTime() < TICK_MS &&
          fresh.getHours() === prev.getHours()
          ? prev
          : fresh;
      });
    });
    return () => sub.remove();
  }, []);
  return now;
}

function reciterFor(
  reciterId: string | undefined,
  rewayatId: string | undefined,
): NowReciter | null {
  if (!reciterId) return null;
  const reciter = RECITERS.find(r => r.id === reciterId);
  if (!reciter) return null;
  const rewayat = findRewayat(reciter, rewayatId);
  if (!rewayat) return null;
  return {
    reciterId: reciter.id,
    rewayatId: rewayat.id,
    surahIds: availableSurahIds(rewayat),
  };
}

export function useBayaanNow(): {moments: NowMoment[]; now: Date} {
  const now = useMomentClock();
  const recent = useRecentlyPlayedStore(s =>
    s.recentTracks.find(t => !t.isUserUpload),
  );
  const defaultReciterId = useReciterStore(s => s.defaultReciter.id);
  const occasion = useBayaanNowOccasion();
  // RECITERS fills after launch: read it again when it does.
  const catalogVersion = useCatalogVersion();

  const recentReciterId = recent?.reciter.id;
  const recentRewayatId = recent?.rewayatId;
  const recentSurahId = recent?.surah.id;
  // progress is the fraction listened (0 to 1).
  const recentCompleted = !!recent && recent.progress >= COMPLETED;

  const moments = useMemo(() => {
    const fromRecent = reciterFor(recentReciterId, recentRewayatId);
    const topReciter = fromRecent ?? reciterFor(defaultReciterId, undefined);
    const lastPlayed: NowLastPlayed | null =
      fromRecent && recentSurahId !== undefined
        ? {...fromRecent, surahId: recentSurahId, completed: recentCompleted}
        : null;
    return bayaanNowMoments({
      now,
      topReciter,
      lastPlayed,
      playlistIds: getSystemPlaylists().map(p => p.id),
      cards: {
        adhkar: isFeatureEnabled('adhkar'),
        bedtime: isFeatureEnabled('sleepTimer'),
      },
      occasion: activeSlots(occasion, now),
      resolveReciter: reciterFor,
    });
    // catalogVersion: RECITERS is read inside, and it fills after launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    now,
    recentReciterId,
    recentRewayatId,
    recentSurahId,
    recentCompleted,
    defaultReciterId,
    occasion,
    catalogVersion,
  ]);
  return {moments, now};
}
