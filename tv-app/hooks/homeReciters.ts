/**
 * Who appears in Home's reciter rails (Recently played, Your favourite
 * reciters, Featured reciters) and whose voice Home plays a surah in. Pure,
 * so the order is unit-tested.
 */
import type {Reciter} from '../types/reciter';
import {featuredFirst} from '../services/browseCatalog';
import {
  popularReciters,
  rewayahForSurah,
  shortReciterName,
} from '../services/listeningChoices';

/** How many reciters a Home rail shows at most. */
export const RECITER_ROW_LIMIT = 12;

/**
 * A reciter's name under a portrait: the app's one short name
 * (listeningChoices' shortReciterName), so a portrait, the tray and the
 * tiles all write a reciter the same way. The portrait reads out the full
 * name.
 */
export function portraitName(name: string): string {
  return shortReciterName(name);
}

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
 * The phone's "Best for memorization" and "Best for tajweed" reciters
 * (data/reciterCollections.ts), in its order. Copied rather than imported:
 * that module pulls in the phone's stores.
 */
export const MEMORIZATION_RECITER_NAMES: readonly string[] = [
  'Mishary Alafasi',
  'Mahmoud Khalil Al-Hussary',
  'Mohammed Siddiq Al-Minshawi Muallim',
  'Khalifa Al-Tunaiji',
  'Mohammed Jibreel',
  'Salah Al-Budair',
  'Abdullah Al-Mattrod',
  'Idrees Abkr',
  'Yassin Al-Jazaery',
  'Abu Bakr Al-Shatri',
];

export const TAJWEED_RECITER_NAMES: readonly string[] = [
  'Mahmoud Khalil Al-Hussary',
  'Mohammed Ayyub',
  'Mohammed Siddiq Al-Minshawi',
  'Abdulbasit Abdulsamad',
  'Mahmoud Ali Albanna',
  'Mustafa Ismail',
  'Abdulrasheed Soufi',
];

/** A name compared loosely: "Khalifa Al-Tunaiji" matches "Khalifa Altunaiji". */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * A curated reciter rail: the catalog's reciters behind `names`, in that
 * order, leaving out names the catalog lacks and reciters the rails above
 * already show, so the row adds someone new.
 */
export function curatedRow(
  reciters: readonly Reciter[],
  names: readonly string[],
  exclude: readonly string[],
  limit = RECITER_ROW_LIMIT,
): Reciter[] {
  const byName = new Map(reciters.map(r => [nameKey(r.name), r]));
  const shown = new Set(exclude);
  const out: Reciter[] = [];
  for (const name of names) {
    const reciter = byName.get(nameKey(name));
    if (reciter && !shown.has(reciter.id) && !out.includes(reciter)) {
      out.push(reciter);
    }
    if (out.length >= limit) break;
  }
  return out;
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
