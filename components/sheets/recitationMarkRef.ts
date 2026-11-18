import {SURAHS} from '@/data/surahData';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import type {MarkKind} from '@/services/recitation/wordMarks';

function surahName(surah: number): string {
  const data = SURAHS[surah - 1];
  return data ? getSurahDisplayName(data) : localizeDigits(surah);
}

/**
 * Where a word mark is, as a sheets string and its values. An added mark's word was
 * read correctly: the extra word came before it.
 * @param position - The word's 1-based position in the ayah
 */
export function recitationMarkRef(
  mark: {surah: number; ayah: number; kind: MarkKind},
  position: number,
) {
  return {
    key:
      mark.kind === 'added'
        ? ('recitationSummary.addedRef' as const)
        : ('recitationSummary.wordRef' as const),
    values: {
      surah: surahName(mark.surah),
      ayah: localizeDigits(mark.ayah),
      word: localizeDigits(position),
    },
  };
}
