import {useCallback} from 'react';
import {useRouter, useSegments} from 'expo-router'; // @ai
import {getAllReciters, getSurahById} from '@/services/dataService';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createTracksForReciter} from '@/utils/track';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {Reciter} from '@/data/reciterData';
import {useSettings} from '@/hooks/useSettings'; // @ai
import {pickRewayatId, reciterHasSurah} from '@/utils/rewayatPreference'; // @ai
// @ai-start
import i18n from '@/i18n';
import {getReciterDisplayName, getSurahDisplayName} from '@/i18n/format';
import {showToast} from '@/utils/toastUtils';
import {reciterBrowsePathname} from '@/hooks/useTabReciterPath';
// @ai-end

export function useReciterSelection() {
  const {updateQueue, play} = usePlayerActions();
  const startNewChain = useRecentlyPlayedStore(s => s.startNewChain); // @ai
  const router = useRouter(); // @ai
  const segments = useSegments(); // @ai

  const playWithReciter = useCallback(
    async (reciter: Reciter, surahId: string) => {
      if (!reciter || !surahId) return;

      try {
        const surah = await getSurahById(parseInt(surahId, 10));
        if (!surah) return;

        // Until the catalogue has loaded, the default reciter is a
        // placeholder with no id and no rewayat: there is nothing to play,
        // and no reciter to name in the message below.
        if (!reciter.id) return false;

        // @ai-start
        // Many reciters have recorded only part of the Quran. Playing a
        // surah the default reciter does not have put a card for it in
        // Continue Listening and sent the player after a file that does not
        // exist. Say so, and open the reciters who do have it, as "Browse
        // all reciters" does.
        if (!reciterHasSurah(reciter.rewayat, surah.id)) {
          showToast(
            i18n.t('sheets:selectReciter.surahUnavailable', {
              reciter: getReciterDisplayName(reciter),
              surah: getSurahDisplayName(surah),
            }),
            i18n.t('sheets:selectReciter.surahUnavailableHint'),
            'error',
          );
          router.push({
            pathname: reciterBrowsePathname(segments),
            params: {view: 'all', surahId: surah.id},
          });
          return false;
        }

        // Play the rewayat the user last picked for this reciter
        const rewayatId = pickRewayatId(
          reciter.rewayat,
          [useSettings.getState().reciterPreferences[reciter.id]],
          surah.id,
        );
        if (!rewayatId) return false;
        // @ai-end
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
    [updateQueue, play, startNewChain, router, segments], // @ai
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
          // @ai-start
          // Nobody has recorded it, so there is nothing to play. This used
          // to fall back to the first reciter in the catalogue and queue a
          // file that does not exist.
          console.warn('No reciters found with surah available');
          showToast(i18n.t('home:randomHero.findFailed'), undefined, 'error');
          return false;
          // @ai-end
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
