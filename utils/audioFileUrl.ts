import type {Rewayat} from '@/data/reciterData';

// The CDN serves recitation files as `immutable` for a year, so a replaced file
// needs a new URL to get past HTTP caches. Bump a rewayat's entry whenever its
// files are replaced in place.
const AUDIO_FILE_VERSIONS: Record<string, number> = {
  // Hasan Saleh, Hafs murattal: 18 surahs had an inverted right channel (silent
  // in mono) and were re-encoded on 2026-10-28.
  '65962996-0864-4ef9-9001-932fdc87c8f8': 2,
};

/** Remote URL of one surah's audio file for a rewayat. */
export function audioFileUrl(
  rewayat: Pick<Rewayat, 'id' | 'server'>,
  surah: number | string,
): string {
  const padded = String(surah).padStart(3, '0');
  const version = AUDIO_FILE_VERSIONS[rewayat.id];
  const url = `${rewayat.server}/${padded}.mp3`;
  return version ? `${url}?v=${version}` : url;
}
