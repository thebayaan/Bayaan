import {useCallback} from 'react';
import type {Surah} from '../../../data/surahData';
import {usePlayer} from '../../hooks/usePlayer';
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
  const {playRewayah, shufflePlayRewayah} = usePlayer();
  const push = useNavStore(s => s.push);
  const switchTab = useNavStore(s => s.switchTab);

  const remember = useCallback(() => recordSearch(query), [query]);

  /** Starts a surah and opens the listening room; false when nobody has it. */
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
      useTVPlayerStore.getState().setShuffle(false);
      useListeningStore
        .getState()
        .setRepeat(opts.repeat ? {kind: 'surah'} : {kind: 'off'}, 0);
      await playRewayah(
        choice.reciter.id,
        choice.reciter.name,
        choice.rewayah,
        surah.id,
      );
      push({screen: 'nowPlaying'});
      return choice;
    },
    [reciters, defaultReciterId, playRewayah, push],
  );

  const playSurah = useCallback(
    async (surah: Surah, opts?: {reciter?: Reciter; repeat?: boolean}) => {
      remember();
      return (await startSurah(surah, opts)) !== null;
    },
    [remember, startSurah],
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
      await shufflePlayRewayah(reciter.id, reciter.name, rewayah);
      push({screen: 'nowPlaying'});
      return true;
    },
    [remember, shufflePlayRewayah, push],
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
    playVerse,
    shuffleReciter,
    openReciter,
    favoriteReciter,
    openAdhkar,
    switchTab,
  };
}

export type SearchActions = ReturnType<typeof useSearchActions>;
