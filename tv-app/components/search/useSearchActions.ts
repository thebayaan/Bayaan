import {useCallback} from 'react';
import type {Surah} from '../../../data/surahData';
import {playOrOpen, randomSurah} from '../../services/playbackRouting';
import {showToast} from '../../store/toastStore';
import {fetchRewayat} from '../../services/tvDataService';
import {recordSearch} from '../../services/searchRecentsStore';
import {getFavorites, toggleFavorite} from '../../services/favoritesStore';
import {
  findVerseSpan,
  pickReciterForSurah,
  pickRewayah,
} from '../../services/search/playback';
import {stopVerseWatch, watchVerseEnd} from '../../services/search/verseWatch';
import type {VerseRef} from '../../services/search/tvSearch';
import type {AdhkarList} from '../../data/adhkarLists';
import {useNavStore, type AdhkarStartMode} from '../../store/navStore';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {useListeningStore} from '../../store/listeningStore';
import type {Reciter, Rewayah} from '../../types/reciter';

export type VerseAction = 'verse' | 'repeat' | 'from';

/** The listening room resets verse repeat as it opens; set it after that. */
const AFTER_PLAYER_OPENS_MS = 600;

async function rewayatOf(reciter: Reciter): Promise<Rewayah[]> {
  if (reciter.rewayat.length > 0) return reciter.rewayat;
  return fetchRewayat(reciter.id).catch(() => []);
}

/**
 * Everything the search screen's buttons do. Each action records the query
 * that led to it in the recent searches, the way the phone records the result
 * a search was used for.
 */
export function useSearchActions(
  query: string,
  reciters: readonly Reciter[],
  defaultReciterId: string | null,
) {
  const push = useNavStore(s => s.push);
  const switchTab = useNavStore(s => s.switchTab);

  const remember = useCallback(() => recordSearch(query), [query]);

  /** Opens the listening room on a surah; null when nobody has it. */
  const startSurah = useCallback(
    async (
      surah: Surah,
      opts: {reciter?: Reciter; repeat?: boolean} = {},
    ): Promise<{reciter: Reciter; rewayah: Rewayah} | null> => {
      let choice: {reciter: Reciter; rewayah: Rewayah} | null = null;
      if (opts.reciter) {
        const rewayah = pickRewayah(await rewayatOf(opts.reciter), surah.id);
        choice = rewayah ? {reciter: opts.reciter, rewayah} : null;
      } else {
        choice = pickReciterForSurah(
          reciters,
          surah.id,
          defaultReciterId,
          getFavorites().map(f => f.reciterId),
        );
      }
      if (!choice) return null;
      stopVerseWatch();
      useListeningStore
        .getState()
        .setRepeat(opts.repeat ? {kind: 'surah'} : {kind: 'off'}, 0);
      // Opens the player at once and resolves once the audio is playing, so
      // a verse can then be sought. A failure shows in the player.
      await playOrOpen({
        reciterId: choice.reciter.id,
        rewayahId: choice.rewayah.id,
        surahNumber: surah.id,
        source: 'search',
      });
      return choice;
    },
    [reciters, defaultReciterId],
  );

  const playSurah = useCallback(
    async (surah: Surah, opts?: {reciter?: Reciter; repeat?: boolean}) => {
      remember();
      return (await startSurah(surah, opts)) !== null;
    },
    [remember, startSurah],
  );

  /** playSurah for presses with no note of their own: a toast says why not. */
  const playSurahOrSay = useCallback(
    async (surah: Surah): Promise<void> => {
      if (await playSurah(surah)) return;
      showToast(`No reciter has ${surah.name} yet.`, 'error');
    },
    [playSurah],
  );

  /**
   * Plays a verse: from its start ('from'), just the verse ('verse'), or the
   * verse on repeat ('repeat'). Without verse timings for the recitation the
   * surah plays from the beginning and the returned note says so.
   */
  const playVerse = useCallback(
    async (ref: VerseRef, action: VerseAction): Promise<string | null> => {
      remember();
      const choice = await startSurah(ref.surah);
      if (!choice) return 'No reciter has this surah yet.';
      // The player is up with its error and Try again.
      if (useTVPlayerStore.getState().status === 'error') return null;
      const span = await findVerseSpan(
        choice.rewayah,
        ref.surah.id,
        ref.surah.verses_count,
        ref.ayah,
      );
      if (!span) {
        return `${choice.reciter.name} has no verse timings here, so ${ref.surah.name} plays from the start.`;
      }
      useTVPlayerStore.getState().seekTo(span.fromMs / 1000);
      if (action === 'verse') {
        watchVerseEnd(span, {
          reciterId: choice.reciter.id,
          surahNumber: ref.surah.id,
        });
      } else if (action === 'repeat') {
        setTimeout(() => {
          useListeningStore
            .getState()
            .setRepeat({kind: 'verse', times: Infinity}, ref.ayah);
        }, AFTER_PLAYER_OPENS_MS);
      }
      return null;
    },
    [remember, startSurah],
  );

  const shuffleReciter = useCallback(
    async (reciter: Reciter): Promise<boolean> => {
      remember();
      const rewayah = pickRewayah(await rewayatOf(reciter));
      if (!rewayah) return false;
      stopVerseWatch();
      useListeningStore.getState().setRepeat({kind: 'off'}, 0);
      void playOrOpen({
        reciterId: reciter.id,
        rewayahId: rewayah.id,
        surahNumber: randomSurah(rewayah.surah_list) ?? 1,
        shuffle: true,
        source: 'search-shuffle',
      });
      return true;
    },
    [remember],
  );

  const openReciter = useCallback(
    (reciter: Reciter) => {
      remember();
      push({screen: 'reciterDetail', reciterId: reciter.id});
    },
    [remember, push],
  );

  const favoriteReciter = useCallback(
    (reciter: Reciter): boolean => {
      remember();
      return toggleFavorite(reciter.id);
    },
    [remember],
  );

  const openAdhkar = useCallback(
    (list: AdhkarList, mode: AdhkarStartMode = 'read') => {
      remember();
      push({
        screen: 'adhkarReader',
        listId: list.id,
        ...(mode === 'read' ? {} : {mode}),
      });
    },
    [remember, push],
  );

  return {
    playSurah,
    playSurahOrSay,
    playVerse,
    shuffleReciter,
    openReciter,
    favoriteReciter,
    openAdhkar,
    switchTab,
  };
}

export type SearchActions = ReturnType<typeof useSearchActions>;
