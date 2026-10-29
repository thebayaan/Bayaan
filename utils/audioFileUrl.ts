import type {Rewayat} from '@/data/reciterData';

// The CDN serves recitation files as `immutable` for a year, so a replaced file
// needs a new URL to get past HTTP caches. Bump a rewayat's entry whenever its
// files are replaced in place: a number versions every surah of the rewayat, a
// map versions only the surahs it lists.
const AUDIO_FILE_VERSIONS: Record<string, number | Record<number, number>> = {
  // Hasan Saleh, Hafs murattal: 20 surahs had an inverted right channel (silent
  // in mono) and were re-encoded on 2026-10-28/29.
  '65962996-0864-4ef9-9001-932fdc87c8f8': 2,
  // Hafs Al-Fatiha recordings that open without the basmala: a basmala was
  // added at the start on 2026-10-29.
  'f877d4f8-0834-4401-a169-f1435a7dff09': {1: 2}, // abdulaziz-alasiri
  '5b2ffba0-d38c-4e96-9b95-4b5edb58477a': {1: 2}, // abdullah-qarafi
  '5af3ea9b-bfb5-4018-9365-c6daf7827c65': {1: 2}, // abdulmajeed-al-arkani
  'e8c4e00b-b84b-4f1f-982f-09fc155b0d3c': {1: 2}, // abdulmohsin-al-askar
  '319a2586-d93e-4494-9f27-6b3e9f6b654b': {1: 2}, // abdulmohsin-al-obaikan
  '15424ace-0623-4ebb-b08b-ff502e974e52': {1: 2}, // abdulrahman-aljuraydhi
  '0e7944ac-de91-4bc2-a6a1-4976140e7eb7': {1: 2}, // abdulwali-al-arkani
  'bfafeb7e-1cde-491e-b816-6e530fbf34f8': {1: 2}, // ahmad-al-nufais
  '81b8f244-577d-457e-b175-2a79afc0f03b': {1: 2}, // ahmad-talib-bin-humaid
  'a762d292-6fd1-4120-a55a-4c18d289f6e4': {1: 2}, // khaled-al-qahtani
  'd7f42caf-d6ee-4f21-a7c9-4b5c25ccd34a': {1: 2}, // khalid-al-shoraimy
  'acf9420e-a268-4951-abfc-050df35e0f11': {1: 2}, // malik-ahmad
  '887424f7-9146-46db-b144-a8b40a6949cf': {1: 2}, // youssef-edghouch
  '697eddea-178e-4c4b-b3e9-04d381c92d59': {1: 2}, // yusuf-al-aidroos
};

/** Remote URL of one surah's audio file for a rewayat. */
export function audioFileUrl(
  rewayat: Pick<Rewayat, 'id' | 'server'>,
  surah: number | string,
): string {
  const padded = String(surah).padStart(3, '0');
  const entry = AUDIO_FILE_VERSIONS[rewayat.id];
  const version = typeof entry === 'number' ? entry : entry?.[Number(surah)];
  const url = `${rewayat.server}/${padded}.mp3`;
  return version ? `${url}?v=${version}` : url;
}
