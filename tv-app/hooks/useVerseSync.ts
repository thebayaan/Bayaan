import {useEffect, useState} from 'react';
import {AppState} from 'react-native';
import SURAHS from '../../data/surahData.json';
import {
  DEFAULT_TRANSLATION,
  fetchTimings,
  fetchTranslation,
  getArabicVerses,
} from '../services/verseData';
import {buildTimeline, type VerseTimeline} from '../services/verseTimeline';
import {retryUntilDone} from '../services/syncRetry';

export type VerseSync = {
  arabic: string[];
  translation: string[] | null;
  /**
   * The translation couldn't be fetched (offline with nothing cached); it is
   * being retried. Null translation without this means it is still loading.
   */
  translationFailed: boolean;
  /** Null until loaded, or when this recitation can't be synced verse by verse. */
  timeline: VerseTimeline | null;
  /**
   * True once the timing lookup has an answer, whatever it found. A lookup
   * that failed is not an answer: it stays false (and is retried), so the
   * room keeps its opening layout rather than call the recitation unsynced.
   */
  timingsSettled: boolean;
  /**
   * The recitation this state is for (syncKey), so a caller can tell it
   * apart from the previous surah's state in the render before the new
   * lookup starts.
   */
  loadedFor: string | null;
};

/** What useVerseSync's state is loaded for: one rewayah's surah. */
export function syncKey(
  surahNumber: number | null,
  rewayahId: string | undefined,
): string | null {
  return surahNumber === null ? null : `${rewayahId ?? ''}:${surahNumber}`;
}

/** A failed lookup is tried again when the app comes back to the front. */
function onForeground(run: () => void): () => void {
  const subscription = AppState.addEventListener('change', next => {
    if (next === 'active') run();
  });
  return () => subscription.remove();
}

type Timings = {
  key: string | null;
  timeline: VerseTimeline | null;
  settled: boolean;
};

type Translation = {
  surahNumber: number | null;
  verses: string[] | null;
  failed: boolean;
};

/**
 * Loads what the listening room shows for one recitation of a surah: the
 * bundled Arabic text right away, then the verse timings and the translation
 * from the network (or their offline cache). The two load apart: choosing
 * another translation leaves the timings (and the verse on screen) alone,
 * and keeps the old translation up until the new one arrives.
 */
export function useVerseSync(
  surahNumber: number | null,
  rewayahId: string | undefined,
  rewayahName: string,
  edition: string = DEFAULT_TRANSLATION,
): VerseSync {
  const [timings, setTimings] = useState<Timings>({
    key: null,
    timeline: null,
    settled: false,
  });
  const [translation, setTranslation] = useState<Translation>({
    surahNumber: null,
    verses: null,
    failed: false,
  });

  useEffect(() => {
    if (surahNumber === null) return;
    const key = syncKey(surahNumber, rewayahId);
    setTimings({key, timeline: null, settled: false});
    if (!rewayahId) {
      setTimings({key, timeline: null, settled: true});
      return;
    }
    let cancelled = false;
    const hafsVerseCount =
      SURAHS.find(s => s.id === surahNumber)?.verses_count ?? 0;
    const stop = retryUntilDone(
      () =>
        fetchTimings(rewayahId, surahNumber).then(
          entries => {
            if (cancelled) return true;
            const timeline = entries
              ? buildTimeline(entries, {
                  surahNumber,
                  hafsVerseCount,
                  rewayahName,
                })
              : null;
            setTimings({key, timeline, settled: true});
            return true;
          },
          // Offline or down: not "no timings". Ask again later.
          () => cancelled,
        ),
      onForeground,
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [surahNumber, rewayahId, rewayahName]);

  useEffect(() => {
    if (surahNumber === null) return;
    let cancelled = false;
    // Another surah's translation doesn't carry over; another edition of
    // this surah stays up until the new one is here.
    setTranslation(t =>
      t.surahNumber === surahNumber
        ? {...t, failed: false}
        : {surahNumber, verses: null, failed: false},
    );
    const stop = retryUntilDone(
      () =>
        fetchTranslation(edition, surahNumber).then(
          verses => {
            if (!cancelled) {
              setTranslation({surahNumber, verses, failed: false});
            }
            return true;
          },
          () => {
            if (!cancelled) setTranslation(t => ({...t, failed: true}));
            return cancelled;
          },
        ),
      onForeground,
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [surahNumber, edition]);

  const translationFresh = translation.surahNumber === surahNumber;
  return {
    arabic: surahNumber === null ? [] : getArabicVerses(surahNumber),
    translation: translationFresh ? translation.verses : null,
    translationFailed:
      translationFresh && translation.failed && translation.verses === null,
    timeline: timings.timeline,
    timingsSettled: timings.settled,
    loadedFor: timings.key,
  };
}
