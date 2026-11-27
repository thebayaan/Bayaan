// @ai-generated
import {SURAHS} from '@/data/surahData';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {
  ayahOfKey,
  surahIdOfKey,
  type VerseRange,
} from '@/utils/playbackRangeSelection';

export function surahNameOf(surah: number): string {
  const s = SURAHS[surah - 1];
  return s ? getSurahDisplayName(s) : String(surah);
}

/** "Al-Baqarah 255". */
export function verseLabel(key: string): string {
  return `${surahNameOf(surahIdOfKey(key))} ${localizeDigits(ayahOfKey(key))}`;
}

/** "Al-Baqarah 6–20", "Al-Fatihah 7 – Al-Baqarah 5", "Al-Baqarah 255". */
export function rangeLabel(range: VerseRange): string {
  if (range.start === range.end) return verseLabel(range.start);
  const ss = surahIdOfKey(range.start);
  const es = surahIdOfKey(range.end);
  if (ss === es) {
    return `${surahNameOf(ss)} ${localizeDigits(
      ayahOfKey(range.start),
    )}–${localizeDigits(ayahOfKey(range.end))}`;
  }
  return `${verseLabel(range.start)} – ${verseLabel(range.end)}`;
}

/** The big From / To figure: "6", or "2:141" when the range spans surahs. */
export function endpointFigure(key: string, crossesSurah: boolean): string {
  return crossesSurah
    ? localizeDigits(`${surahIdOfKey(key)}:${ayahOfKey(key)}`)
    : localizeDigits(ayahOfKey(key));
}
