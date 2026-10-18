import {useCallback} from 'react';
import type {Surah} from '../../../data/surahData';
import {
  isCurrentTrack,
  playOrOpen,
  randomSurah,
} from '../../services/playbackRouting';
import {showToast} from '../../store/toastStore';
import {fetchRewayat} from '../../services/tvDataService';
import {recordSearch} from '../../services/searchRecentsStore';
import {getFavorites, toggleFavorite} from '../../services/favoritesStore';
import {
  findVerseSpan,
  pickReciterForSurah,
  pickRewayah,
  verseFallbackNote,
  within,
} from '../../services/search/playback';
import {stopVerseWatch, watchVerseEnd} from '../../services/search/verseWatch';
import type {VerseRef} from '../../services/search/tvSearch';
import type {AdhkarList} from '../../data/adhkarLists';
import {useNavStore, type AdhkarStartMode} from '../../store/navStore';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {useListeningStore} from '../../store/listeningStore';
import type {Reciter, Rewayah} from '../../types/reciter';

export type VerseAction = 'verse' | 'repeat' | 'from';

/**
 * How long a verse press waits for its verse timings before opening the
 * player, so playback starts at the verse rather than at verse 1 and then
 * jumping. Cached timings (any surah played before) arrive at once, a quick
 * fetch inside this; slower than this, the player opens and loads while the
 * fetch goes on, and the seek follows as soon as both are done. Short, as
 * nothing shows the press until the player opens.
 */
const TIMINGS_WAIT_MS = 400;

type Choice = {reciter: Reciter; rewayah: Rewayah};

/** Whether the player is still on the choice's surah (nobody moved on). */
function onTrack(choice: Choice, surah: number): boolean {
  const player = useTVPlayerStore.getState();
  const item = player.queue[player.currentIndex];
  return (
    player.status !== 'error' &&
    item?.reciterId === choice.reciter.id &&
    item?.surahNumber === surah
  );
}

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

  /** Who plays a surah: the asked-for reciter, or the usual order. */
  const chooseVoice = useCallback(
    async (surah: Surah, reciter?: Reciter): Promise<Choice | null> => {
      if (reciter) {
        const rewayah = pickRewayah(await rewayatOf(reciter), surah.id);
        return rewayah ? {reciter, rewayah} : null;
      }
      return pickReciterForSurah(
        reciters,
        surah.id,
        defaultReciterId,
        getFavorites().map(f => f.reciterId),
      );
    },
    [reciters, defaultReciterId],
  );

  /**
   * Opens the listening room on a surah in the chosen voice. Resolves once
   * the audio is playing (a failure shows in the player).
   */
  const playChoice = useCallback(
    async (
      surah: Surah,
      choice: Choice,
      opts: {repeat?: boolean; startSeconds?: number} = {},
    ): Promise<void> => {
      stopVerseWatch();
      useListeningStore
        .getState()
        .setRepeat(opts.repeat ? {kind: 'surah'} : {kind: 'off'}, 0);
      await playOrOpen({
        reciterId: choice.reciter.id,
        rewayahId: choice.rewayah.id,
        surahNumber: surah.id,
        startSeconds: opts.startSeconds,
        source: 'search',
      });
    },
    [],
  );

  /** Opens the listening room on a surah; null when nobody has it. */
  const startSurah = useCallback(
    async (
      surah: Surah,
      opts: {reciter?: Reciter; repeat?: boolean} = {},
    ): Promise<Choice | null> => {
      const choice = await chooseVoice(surah, opts.reciter);
      if (!choice) return null;
      await playChoice(surah, choice, {repeat: opts.repeat});
      return choice;
    },
    [chooseVoice, playChoice],
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
   * verse on repeat ('repeat'). The verse timings are fetched first, for a
   * moment (TIMINGS_WAIT_MS), so the recitation starts at the verse; when
   * they come later they load beside the audio and the seek follows.
   * Without timings for the recitation the surah plays from the beginning
   * and a toast says so. Notes go to the toast, not the search card: by the
   * time they are known the player has replaced Search.
   */
  const playVerse = useCallback(
    async (ref: VerseRef, action: VerseAction): Promise<void> => {
      remember();
      const surah = ref.surah;
      const choice = await chooseVoice(surah);
      if (!choice) {
        showToast(`No reciter has ${surah.name} yet.`, 'error');
        return;
      }
      const lookup = findVerseSpan(
        choice.rewayah,
        surah.id,
        surah.verses_count,
        ref.ayah,
      );
      const early = await within(lookup, TIMINGS_WAIT_MS);
      const track = {
        reciterId: choice.reciter.id,
        rewayahId: choice.rewayah.id,
        surahNumber: surah.id,
      };
      // The track already playing just opens the player, ignoring a start.
      const wasPlaying = isCurrentTrack(track);
      await playChoice(surah, choice, {
        startSeconds: early ? early.fromMs / 1000 : undefined,
      });
      // The player is up with its error, or a newer press (or the
      // listener) moved on to something else.
      if (!onTrack(choice, surah.id)) return;
      const span = early === undefined ? await lookup : early;
      if (!span) {
        showToast(verseFallbackNote(choice.reciter.name, surah.name));
        return;
      }
      // Checked again after the wait for the timings: the verse belongs to
      // this surah only.
      if (!onTrack(choice, surah.id)) return;
      if (early === undefined || wasPlaying) {
        useTVPlayerStore.getState().seekTo(span.fromMs / 1000);
      }
      if (action === 'verse') {
        watchVerseEnd(span, track);
      } else if (action === 'repeat') {
        // The listening room keeps whatever repeat is set; set here, it is
        // stamped with this track, never one played after it.
        useListeningStore
          .getState()
          .setRepeat({kind: 'verse', times: Infinity}, ref.ayah);
      }
    },
    [remember, chooseVoice, playChoice],
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
