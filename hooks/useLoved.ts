import {useCallback} from 'react';
import {useLoved as useLovedStore} from '@/services/player/store/lovedStore';
import {Track} from '@/types/audio';

interface UseLoved {
  lovedTracks: Array<{reciterId: string; surahId: string}>;
  isLoved: (reciterId: string, surahId: string | number) => boolean;
  toggleLoved: (reciterId: string, surahId: string | number) => void;
  isTrackLoved: (track: Track) => boolean;
  toggleTrackLoved: (track: Track) => void;
}

export const useLoved = (): UseLoved => {
  const {
    lovedTracks,
    toggleLoved: toggleLovedBase,
    isLoved: isLovedBase,
  } = useLovedStore();

  const isLoved = useCallback(
    (reciterId: string, surahId: string | number) => {
      return isLovedBase(reciterId, surahId.toString());
    },
    [isLovedBase],
  );

  const toggleLoved = useCallback(
    (reciterId: string, surahId: string | number) => {
      toggleLovedBase(reciterId, surahId.toString());
    },
    [toggleLovedBase],
  );

  const isTrackLoved = useCallback(
    (track: Track) => {
      if (!track.reciterId || !track.surahId) return false;
      return isLoved(track.reciterId, track.surahId);
    },
    [isLoved],
  );

  const toggleTrackLoved = useCallback(
    (track: Track) => {
      if (!track.reciterId || !track.surahId) return;
      toggleLoved(track.reciterId, track.surahId);
    },
    [toggleLoved],
  );

  return {
    lovedTracks,
    isLoved,
    toggleLoved,
    isTrackLoved,
    toggleTrackLoved,
  };
};
