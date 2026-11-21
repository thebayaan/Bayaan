// @ai-generated
// A warm bayaan://mushaf?page=N is a NAVIGATE to /mushaf. The root stack
// moves to a reader only when it is on top, so with another screen over the
// open reader (Translations, say), the link pushed a second reader. The link
// routes go to the open reader (components/mushaf/ReaderLinkRedirect.tsx),
// so a warm query link that holds only the params of a link route goes
// through that route. A cold link opens one reader either way: it stays as
// it is.
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  const match = /^([^?]*\/|)mushaf\?([^#]*)$/.exec(path);
  if (initial || !match) return path;
  const [, prefix, query] = match;
  const params = new Map(
    query.split('&').map(pair => pair.split('=') as [string, string]),
  );
  if (![...params.values()].every(value => /^\d+$/.test(value))) return path;
  const {page, surah, ayah} = Object.fromEntries(params);
  if (page && params.size === 1) return `${prefix}mushaf/${page}`;
  if (surah && params.size === (ayah ? 2 : 1)) {
    return `${prefix}quran/${surah}${ayah ? `?ayah=${ayah}` : ''}`;
  }
  return path;
}
