import type {ExpectedPassage} from '@tilawa/core';

/**
 * The passage the reader is expected to recite on a page: from `from` (or
 * the page's first ayah) to the last ayah of the same surah on the page. A
 * correction-mode passage is one surah; the next surah on the page starts a
 * new passage. Null when `from` is not on the page or the page is empty.
 */
export function passageOnPage(
  keys: readonly string[],
  from?: {surah: number; ayah: number},
): ExpectedPassage | null {
  const ayat = keys.map(key => {
    const [surah, ayah] = key.split(':').map(Number);
    return {surah, ayah};
  });
  const start = from
    ? ayat.findIndex(a => a.surah === from.surah && a.ayah === from.ayah)
    : 0;
  if (start < 0 || start >= ayat.length) return null;
  const {surah, ayah} = ayat[start];
  let end = ayah;
  for (let i = start + 1; i < ayat.length && ayat[i].surah === surah; i++) {
    end = ayat[i].ayah;
  }
  return {surah, ayah, ayahEnd: end};
}
