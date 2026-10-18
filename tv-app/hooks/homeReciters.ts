/**
 * Who appears in Home's reciter rails (Recently played, Your favourite
 * reciters, Featured reciters) and whose voice Home plays a surah in. Pure,
 * so the order is unit-tested.
 */
import type {Reciter} from '../types/reciter';
import {featuredFirst} from '../services/browseCatalog';
import {popularReciters, rewayahForSurah} from '../services/listeningChoices';

/** How many reciters a Home rail shows at most. */
export const RECITER_ROW_LIMIT = 12;

/**
 * The reciters behind `ids`, in that order: unknown ids (a reciter no longer
 * in the catalog) and repeats are left out.
 */
export function recitersByIds(
  ids: readonly string[],
  reciters: readonly Reciter[],
  limit = RECITER_ROW_LIMIT,
): Reciter[] {
  const byId = new Map(reciters.map(r => [r.id, r]));
  const out: Reciter[] = [];
  for (const id of new Set(ids)) {
    const reciter = byId.get(id);
    if (reciter) out.push(reciter);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The featured voices (the phone's list first), leaving out reciters the
 * rails above already show so the row adds someone new.
 */
export function featuredRow(
  reciters: readonly Reciter[],
  exclude: readonly string[],
  limit = RECITER_ROW_LIMIT,
): Reciter[] {
  const shown = new Set(exclude);
  return featuredFirst(reciters)
    .filter(r => !shown.has(r.id))
    .slice(0, limit);
}

/**
 * Whose voice Home plays a surah in, best first: the chosen default (or the
 * app's pick), then favourites, then the best-known voices. Home plays with
 * the first who has the surah (playbackRouting.voiceForSurah), so a default
 * reciter without it never starts some other surah instead.
 */
export function homeVoiceCandidates({
  reciters,
  first,
  favoriteIds,
}: {
  reciters: readonly Reciter[];
  first: Reciter | null;
  favoriteIds: readonly string[];
}): Reciter[] {
  const out: Reciter[] = [];
  const add = (r: Reciter | null | undefined): void => {
    if (r && !out.includes(r)) out.push(r);
  };
  add(first);
  recitersByIds(favoriteIds, reciters, Number.MAX_SAFE_INTEGER).forEach(add);
  popularReciters(reciters, 15).forEach(add);
  return out;
}

/** The order "Another reciter" ranks voices in: favourites, default, recent. */
export function preferredReciterIds({
  favoriteIds,
  defaultId,
  recentIds,
}: {
  favoriteIds: readonly string[];
  defaultId: string | null;
  recentIds: readonly string[];
}): string[] {
  return [
    ...new Set([
      ...favoriteIds,
      ...(defaultId ? [defaultId] : []),
      ...recentIds,
    ]),
  ];
}

/**
 * Whether "Another reciter" has anyone to offer for the surah. Home checks
 * first, so the picker never opens empty with focus trapped in it.
 */
export function hasReciterChoice(
  reciters: readonly Reciter[],
  surahNumber: number,
): boolean {
  return reciters.some(r => rewayahForSurah(r, surahNumber) !== null);
}
