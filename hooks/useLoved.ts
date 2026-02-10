import {useCallback} from 'react';
import {useLoved as useLovedStore} from '@/services/player/store/lovedStore';
import {Track} from '@/types/audio';

interface UseLoved {
  lovedTracks: Array<{
    reciterId: string;
    surahId: string;
    rewayatId: string;
    timestamp: number;
    userRecitationId?: string;
  }>;
  isLoved: (reciterId: string, surahId: string | number) => boolean;
  isLovedWithRewayat: (
    reciterId: string,
    surahId: string | number,
    rewayatId: string,
  ) => boolean;
  toggleLoved: (
    reciterId: string,
    surahId: string | number,
    rewayatId: string,
    userRecitationId?: string,
  ) => void;
  isTrackLoved: (track: Track) => boolean;
  toggleTrackLoved: (track: Track) => void;
  unloveAll: () => void;
}

export const useLoved = (): UseLoved => {
  const {
    lovedTracks,
    toggleLoved: toggleLovedBase,
    isLoved: isLovedBase,
    isLovedWithRewayat: isLovedWithRewayatBase,
    clearLoved: clearLovedBase,
  } = useLovedStore();

  const isLoved = useCallback(
    (reciterId: string, surahId: string | number) => {
      return isLovedBase(reciterId, surahId.toString());
    },
    [isLovedBase],
  );

  const isLovedWithRewayat = useCallback(
    (reciterId: string, surahId: string | number, rewayatId: string) => {
      return isLovedWithRewayatBase(reciterId, surahId.toString(), rewayatId);
    },
    [isLovedWithRewayatBase],
  );

  const toggleLoved = useCallback(
    (
      reciterId: string,
      surahId: string | number,
      rewayatId: string,
      userRecitationId?: string,
    ) => {
      toggleLovedBase(
        reciterId,
        surahId.toString(),
        rewayatId,
        userRecitationId,
      );
    },
    [toggleLovedBase],
  );

  const isTrackLoved = useCallback(
    (track: Track) => {
      if (!track.reciterId || !track.surahId) return false;
      const rewayatId = track.rewayatId || '';
      return isLovedWithRewayat(track.reciterId, track.surahId, rewayatId);
    },
    [isLovedWithRewayat],
  );

  const toggleTrackLoved = useCallback(
    (track: Track) => {
      if (!track.reciterId || !track.surahId) return;
      const rewayatId = track.rewayatId || '';
      toggleLoved(track.reciterId, track.surahId, rewayatId);
    },
    [toggleLoved],
  );

  const unloveAll = useCallback(() => {
    clearLovedBase();
  }, [clearLovedBase]);

  return {
    lovedTracks,
    isLoved,
    isLovedWithRewayat,
    toggleLoved,
    isTrackLoved,
    toggleTrackLoved,
    unloveAll,
  };
};
