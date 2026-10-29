// @ai-generated
import {useCallback, useEffect, useState} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useLoved} from '@/hooks/useLoved';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {useCurrentTrackResolvedRewayah} from '@/hooks/useCurrentTrackRewayah';
import {getShortLabel} from '@/services/rewayah/RewayahIdentity';
import {getReciterById} from '@/services/dataService';
import {getTrackArtistDisplay, getTrackDisplayTitle} from '@/i18n/format';
import {getRecitationStyleTitle} from '@/components/player/v2/recitationStyle';
import type {Rewayat} from '@/data/reciterData';

/**
 * What the iPad player shows about the current track: title, reciter, the
 * rewayah and style label ("Hafs · Murattal"), the loved state, and a
 * handler that opens the reciter's profile.
 */
export function useNowPlayingMeta() {
  const queue = usePlayerStore(s => s.queue);
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const resolvedRewayah = useCurrentTrackResolvedRewayah();
  const {navigateToReciterProfile} = useReciterNavigation();
  const {isTrackLoved, toggleTrackLoved} = useLoved();

  const [rewayat, setRewayat] = useState<Rewayat | null>(null);
  useEffect(() => {
    setRewayat(null);
    let alive = true;
    (async () => {
      if (!currentTrack?.reciterId || !currentTrack.rewayatId) return;
      try {
        const reciter = await getReciterById(currentTrack.reciterId);
        if (!alive || !reciter?.rewayat) return;
        const found = reciter.rewayat.find(
          r => r.id === currentTrack.rewayatId,
        );
        if (found) setRewayat(found);
      } catch (e) {
        console.error('useNowPlayingMeta: load reciter failed', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentTrack]);

  const rewayahLabel =
    resolvedRewayah && (rewayat || currentTrack?.rewayahName)
      ? `${getShortLabel(resolvedRewayah.id)}${
          rewayat?.style ? ` · ${getRecitationStyleTitle(rewayat.style)}` : ''
        }`
      : null;

  const goToReciter = useCallback(() => {
    if (currentTrack?.reciterId) {
      navigateToReciterProfile(currentTrack.reciterId);
    }
  }, [currentTrack, navigateToReciterProfile]);

  const isLoved = currentTrack ? isTrackLoved(currentTrack) : false;
  const toggleLoved = useCallback(() => {
    if (currentTrack) toggleTrackLoved(currentTrack);
  }, [currentTrack, toggleTrackLoved]);

  return {
    currentTrack,
    title: currentTrack ? getTrackDisplayTitle(currentTrack) : '',
    artist: currentTrack ? getTrackArtistDisplay(currentTrack) : '',
    rewayahLabel,
    goToReciter,
    isLoved,
    toggleLoved,
  };
}
