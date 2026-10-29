// @ai-generated
import type {Rewayat} from '@/data/reciterData';

type RewayatChoice = Pick<Rewayat, 'id' | 'surah_list'>;

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
      : rewayat.filter(r => !r.surah_list || r.surah_list.includes(surahId));
  const pool = withSurah.length > 0 ? withSurah : rewayat;

  for (const id of candidates) {
    if (id && pool.some(r => r.id === id)) return id;
  }
  return pool[0]?.id;
}
