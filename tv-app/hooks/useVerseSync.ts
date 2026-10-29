import {useEffect, useState} from 'react';
import SURAHS from '../../data/surahData.json';
import {
  DEFAULT_TRANSLATION,
  fetchTimings,
  fetchTranslation,
  getArabicVerses,
} from '../services/verseData';
import {buildTimeline, type VerseTimeline} from '../services/verseTimeline';

export type VerseSync = {
  arabic: string[];
  translation: string[] | null;
  /** Null until loaded, or when this recitation can't be synced verse by verse. */
  timeline: VerseTimeline | null;
  /** True once the timing lookup has finished, whatever it found. */
  timingsSettled: boolean;
};

/**
 * Loads what the listening room shows for one recitation of a surah: the
 * bundled Arabic text right away, then the verse timings and the translation
 * from the network (or their offline cache).
 */
export function useVerseSync(
  surahNumber: number | null,
  rewayahId: string | undefined,
  rewayahName: string,
  edition: string = DEFAULT_TRANSLATION,
): VerseSync {
  const [state, setState] = useState<VerseSync>({
    arabic: [],
    translation: null,
    timeline: null,
    timingsSettled: false,
  });

  useEffect(() => {
    if (surahNumber === null) return;
    let cancelled = false;
    const hafsVerseCount =
      SURAHS.find(s => s.id === surahNumber)?.verses_count ?? 0;
    setState({
      arabic: getArabicVerses(surahNumber),
      translation: null,
      timeline: null,
      timingsSettled: false,
    });

    const timings = rewayahId
      ? fetchTimings(rewayahId, surahNumber).catch(() => null)
      : Promise.resolve(null);
    void timings.then(entries => {
      if (cancelled) return;
      const timeline = entries
        ? buildTimeline(entries, {surahNumber, hafsVerseCount, rewayahName})
        : null;
      setState(s => ({...s, timeline, timingsSettled: true}));
    });

    fetchTranslation(edition, surahNumber)
      .then(translation => {
        if (!cancelled) setState(s => ({...s, translation}));
      })
      // Offline with nothing cached: the Arabic still shows on its own.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [surahNumber, rewayahId, rewayahName, edition]);

  return state;
}
