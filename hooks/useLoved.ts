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
    userRecitationId?: string, // @ai
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

  // @ai-start
  const isLovedWithRewayat = useCallback(
    (
      reciterId: string,
      surahId: string | number,
      rewayatId: string,
      userRecitationId?: string,
    ) => {
      return isLovedWithRewayatBase(
        reciterId,
        surahId.toString(),
        rewayatId,
        userRecitationId,
      );
    },
    [isLovedWithRewayatBase],
  );
  // @ai-end

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

  // @ai-start
  // An upload is loved as itself: saved without a rewayah and with its own
  // id, the way the Uploads screen saves it. Passing only its reciter, surah
  // and rewayah made the player's heart love the catalogue recording
  // instead, so Loved later played that and not the upload.
  const isTrackLoved = useCallback(
    (track: Track) => {
      if (!track.reciterId || !track.surahId) return false;
      if (track.userRecitationId) {
        return isLovedWithRewayat(
          track.reciterId,
          track.surahId,
          '',
          track.userRecitationId,
        );
      }
      const rewayatId = track.rewayatId || '';
      return isLovedWithRewayat(track.reciterId, track.surahId, rewayatId);
    },
    [isLovedWithRewayat],
  );

  const toggleTrackLoved = useCallback(
    (track: Track) => {
      // An upload with no reciter or surah cannot be shown in Loved, so it
      // cannot be loved (the Uploads screen does not offer it either).
      if (!track.reciterId || !track.surahId) return;
      if (track.userRecitationId) {
        toggleLoved(track.reciterId, track.surahId, '', track.userRecitationId);
        return;
      }
      const rewayatId = track.rewayatId || '';
      toggleLoved(track.reciterId, track.surahId, rewayatId);
    },
    [toggleLoved],
  );
  // @ai-end

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
