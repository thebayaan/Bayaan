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
