// @ai-generated
import type {Rewayat} from '@/data/reciterData';
import {HAFS_REWAYAT_NAME} from '@/data/rewayat';

type RewayatChoice = Pick<Rewayat, 'id' | 'surah_list'>;

/** Whether a rewayah has a recording of the surah. No list means all. */
export function rewayahHasSurah(
  rewayah: Pick<RewayatChoice, 'surah_list'>,
  surahId: number,
): boolean {
  return !rewayah.surah_list || rewayah.surah_list.includes(surahId);
}

/**
 * Whether the reciter has recorded the surah in any rewayah. Check this
 * before playing a surah the user did not pick from this reciter's own list:
 * `pickRewayatId` still returns a rewayah when none has the surah.
 */
export function reciterHasSurah(
  rewayat: readonly Pick<RewayatChoice, 'surah_list'>[],
  surahId: number,
): boolean {
  return rewayat.some(r => rewayahHasSurah(r, surahId));
}

/**
 * Picks which rewayah to open or play for a reciter. The candidates are
 * tried in order (for example the id passed by navigation, then the one the
 * user last chose for this reciter); the first that the reciter still has
 * wins, otherwise the first rewayah. With a surahId, only rewayat that
 * include that surah are considered, unless none do.
 */
export function pickRewayatId(
  rewayat: readonly RewayatChoice[],
  candidates: readonly (string | null | undefined)[],
  surahId?: number,
): string | undefined {
  const withSurah =
    surahId == null
      ? rewayat
      : rewayat.filter(r => rewayahHasSurah(r, surahId));
  const pool = withSurah.length > 0 ? withSurah : rewayat;

  for (const id of candidates) {
    if (id && pool.some(r => r.id === id)) return id;
  }
  return pool[0]?.id;
}

/**
 * A reciter's recordings in the order the profile shows them: Hafs
 * murattal first, then other Hafs, then other murattal. Moved here from
 * ReciterProfile so Browse plays the recording the profile opens on. @ai
 */
export function sortRewayat(rewayat: Rewayat[]): Rewayat[] {
  return [...rewayat].sort((a, b) => {
    const aIsHafsMurattal =
      a.name === HAFS_REWAYAT_NAME && a.style === 'murattal';
    const bIsHafsMurattal =
      b.name === HAFS_REWAYAT_NAME && b.style === 'murattal';
    if (aIsHafsMurattal && !bIsHafsMurattal) return -1;
    if (!aIsHafsMurattal && bIsHafsMurattal) return 1;

    const aIsHafs = a.name === HAFS_REWAYAT_NAME;
    const bIsHafs = b.name === HAFS_REWAYAT_NAME;
    if (aIsHafs && !bIsHafs) return -1;
    if (!aIsHafs && bIsHafs) return 1;

    const aIsMurattal = a.style === 'murattal';
    const bIsMurattal = b.style === 'murattal';
    if (aIsMurattal && !bIsMurattal) return -1;
    if (!aIsMurattal && bIsMurattal) return 1;

    return 0;
  });
}
