import {popularReciters} from './listeningChoices';
import type {Reciter} from '../types/reciter';

/** Popular voices listed right after the current pick. */
export const PICKER_POPULAR_COUNT = 12;

/**
 * Whether one of the reciter's recitations covers the whole Quran, as the
 * phone's default-reciter screen requires: a default without every surah
 * would switch voice on the surahs it is missing.
 */
export function hasCompleteQuran(reciter: Reciter): boolean {
  return reciter.rewayat.some(
    rw => (rw.surah_list ?? []).filter(n => n !== null).length >= 114,
  );
}

/**
 * Every reciter who can be the default, for the Settings picker and the
 * onboarding browse panel: the current pick first (even if incomplete, so it
 * still shows as selected), then the popular voices, then everyone else with
 * the whole Quran by name. Nothing is capped; the panel virtualises the list.
 */
export function defaultReciterChoices(
  reciters: readonly Reciter[],
  currentId: string | null,
  popularCount: number = PICKER_POPULAR_COUNT,
): Reciter[] {
  const current = reciters.find(r => r.id === currentId);
  const complete = reciters.filter(r => r !== current && hasCompleteQuran(r));
  const popular = popularReciters(complete, popularCount);
  const rest = complete
    .filter(r => !popular.includes(r))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...(current ? [current] : []), ...popular, ...rest];
}
