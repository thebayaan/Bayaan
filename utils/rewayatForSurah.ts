// @ai-generated
import type {Reciter, Rewayat} from '@/data/reciterData';

/**
 * True when `rewayat` has a recording of `surahId`. A rewayah with no
 * `surah_list` counts as complete, and an empty list as no surah, the same
 * way `getAvailableSurahs` (utils/track.ts) and `fetchAudioUrl` read it.
 */
export function rewayatHasSurah(
  rewayat: Pick<Rewayat, 'surah_list'>,
  surahId: number,
): boolean {
  const list = rewayat.surah_list as (number | null)[] | undefined;
  if (!list) return true;
  return list.includes(surahId);
}

/**
 * The rewayah of `reciter` that plays `surahId`.
 *
 * Takes the rewayah with `preferredId` when it has the surah, else the first
 * rewayah (in the order of `reciter.rewayat`) that has it, else undefined. A
 * reciter's first rewayah need not have every surah, so a caller with no
 * rewayah must not take `reciter.rewayat[0]` on its own: its url is a file
 * that does not exist, and the player loads nothing.
 */
export function findRewayatForSurah(
  reciter: Pick<Reciter, 'rewayat'>,
  surahId: number,
  preferredId?: string,
): Rewayat | undefined {
  const preferred = preferredId
    ? reciter.rewayat.find(r => r.id === preferredId)
    : undefined;
  if (preferred && rewayatHasSurah(preferred, surahId)) return preferred;
  return reciter.rewayat.find(r => rewayatHasSurah(r, surahId));
}

/**
 * The rewayah id to play `surahId` in when the caller has none (a loved
 * surah saved without one, a track built with no rewayah): the first rewayah
 * that has the surah. When none has it, the first rewayah, as before, so the
 * result is never worse than the old `reciter.rewayat[0]` default.
 */
export function defaultRewayatIdForSurah(
  reciter: Pick<Reciter, 'rewayat'>,
  surahId: number,
): string | undefined {
  return findRewayatForSurah(reciter, surahId)?.id ?? reciter.rewayat[0]?.id;
}
