// A type alias (not an interface) so it is assignable to expo-router params.
export type QuranLinkParams = {
  surah: string;
  ayah?: string;
  page?: string;
};

/**
 * Mushaf route params for a /quran/{surah}?ayah=N link. The reader resolves a
 * bare surah to its first page, so pass the ayah's page when it is known.
 */
export function quranLinkParams(
  surah: string,
  ayah: string | undefined,
  pageForVerse: (verseKey: string) => number | undefined,
): QuranLinkParams {
  if (!ayah) return {surah};
  const page = pageForVerse(`${surah}:${ayah}`);
  return page === undefined ? {surah, ayah} : {surah, ayah, page: String(page)};
}

// @ai-start
/**
 * Mushaf route params that open a Quran search hit: the page of its first
 * matched word, an anchor on that word ('S:A:W', so the shown rewayah
 * selects the verse holding it), and the matched Digital Khatt slots to
 * flash ('3,4').
 */
export function quranHitLinkParams(
  verseKey: string,
  positions: readonly number[],
  pageForWord: (verseKey: string, position: number) => number | undefined,
): QuranLinkParams & {anchor: string; words: string} {
  const [surah, ayah] = verseKey.split(':');
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  const first = sorted[0] ?? 1;
  const params = {
    surah,
    ayah,
    anchor: `${verseKey}:${first}`,
    words: sorted.join(','),
  };
  const page = pageForWord(verseKey, first);
  return page === undefined ? params : {...params, page: String(page)};
}
// @ai-end

export type QuranLinkResolution =
  | {status: 'pending'}
  | {status: 'ready'; params: QuranLinkParams};

/**
 * When to hand a /quran link to the reader. On a cold start the link
 * arrives before the mushaf data has loaded, so the ayah's page is not
 * known yet and the reader would open the surah's first page. Wait until
 * the page is known, or until loading has finished (`dataSettled`) without
 * one, and then pass whatever is known.
 */
export function resolveQuranLink(
  surah: string,
  ayah: string | undefined,
  pageForVerse: (verseKey: string) => number | undefined,
  dataSettled: boolean,
): QuranLinkResolution {
  const params = quranLinkParams(surah, ayah, pageForVerse);
  if (!ayah || params.page !== undefined || dataSettled) {
    return {status: 'ready', params};
  }
  return {status: 'pending'};
}
