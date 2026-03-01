import {useCallback} from 'react';
import {getAllReciters, getSurahById} from '@/services/dataService';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createTracksForReciter} from '@/utils/track';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {Reciter} from '@/data/reciterData';

export function useReciterSelection() {
  const {updateQueue, play} = usePlayerActions();
  const {startNewChain} = useRecentlyPlayedStore();

  const playWithReciter = useCallback(
    async (reciter: Reciter, surahId: string) => {
      if (!reciter || !surahId) return;

      try {
        const surah = await getSurahById(parseInt(surahId, 10));
        if (!surah) return;

        // Create track for the selected surah
        const rewayatId = reciter.rewayat[0]?.id;
        const tracks = await createTracksForReciter(
          reciter,
          [surah],
          rewayatId,
        );

        // Update recently played immediately so UI reflects new track
        startNewChain(reciter, surah, 0, 0, rewayatId);

        // Then load audio and start playing
        await updateQueue(tracks, 0);
        await play();

        return true;
      } catch (error) {
        console.error('Error playing surah:', error);
        return false;
      }
    },
    [updateQueue, play, startNewChain],
  );

  const playWithRandomReciter = useCallback(
    async (surahId: string) => {
      if (!surahId) return false;

      try {
        const surahIdNumber = parseInt(surahId, 10);
        if (isNaN(surahIdNumber)) return false;

        const surah = await getSurahById(surahIdNumber);
        if (!surah) return false;

        // Get all reciters
        const allReciters = await getAllReciters();
        if (!allReciters.length) return false;

        // Filter reciters that have this surah available
        const availableReciters = allReciters.filter(reciter =>
          reciter.rewayat.some(
            rewayat =>
              !rewayat.surah_list ||
              rewayat.surah_list
                .filter((id): id is number => id !== null)
                .includes(surahIdNumber),
          ),
        );

        let selectedReciter: Reciter;

        // If we have reciters with this surah available, pick one randomly
        if (availableReciters.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * availableReciters.length,
          );
          selectedReciter = availableReciters[randomIndex];
        } else {
          // Fallback to first reciter (should never happen as all reciters should have all surahs)
          console.warn(
            'No reciters found with surah available, using fallback',
          );
          selectedReciter = allReciters[0];
        }

        // Find rewayat that has this surah
        const validRewayat = selectedReciter.rewayat.find(
          rewayat =>
            !rewayat.surah_list ||
            rewayat.surah_list
              .filter((id): id is number => id !== null)
              .includes(surahIdNumber),
        );

        // Use the first rewayat as fallback
        const rewayatId = validRewayat?.id || selectedReciter.rewayat[0]?.id;

        // Create tracks for the selected surah
        const tracks = await createTracksForReciter(
          selectedReciter,
          [surah],
          rewayatId,
        );

        startNewChain(selectedReciter, surah, 0, 0, rewayatId);

        await updateQueue(tracks, 0);
        await play();

        return true;
      } catch (error) {
        console.error('Error playing with random reciter:', error);
        return false;
      }
    },
    [updateQueue, play, startNewChain],
  );

  return {
    playWithReciter,
    playWithRandomReciter,
  };
}
