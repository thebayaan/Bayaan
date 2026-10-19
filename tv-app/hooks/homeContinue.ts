/**
 * Home's Continue listening rail. The store re-sorts its entries every few
 * seconds while audio plays (the newest write first), which would slide the
 * cards, focused one included, under the user. While focus is in the rail,
 * Home keeps the order it showed and only updates each card's progress in
 * place (a new entry joins at the end); once focus leaves, the rail goes
 * back to newest first, so the surah just played leads it. Pure, so the
 * ordering is unit-tested.
 */
import type {ContinueEntry} from '../services/continueListeningStore';
import {formatMinutes} from './homeMoments';

/** From this far through, a Continue card says "Almost done". */
export const ALMOST_DONE_FRACTION = 0.9;

export function continueKey(entry: {
  reciterId: string;
  surahNumber: number;
}): string {
  return `${entry.reciterId}:${entry.surahNumber}`;
}

/**
 * While `held` (focus is in the rail): `entries` in the order of `shownKeys`
 * (the keys Home showed before), then any new ones in the store's order.
 * Otherwise the store's order, newest first. Entries that left the store
 * (finished, removed) drop out. Returns the entries and the keys to remember.
 */
export function stableContinue(
  shownKeys: readonly string[],
  entries: readonly ContinueEntry[],
  held = true,
): {entries: ContinueEntry[]; keys: string[]} {
  const byKey = new Map(entries.map(e => [continueKey(e), e]));
  const kept = held ? shownKeys.filter(k => byKey.has(k)) : [];
  const keptSet = new Set(kept);
  const added = entries.map(continueKey).filter(k => !keptSet.has(k));
  const keys = [...kept, ...added];
  return {entries: keys.map(k => byKey.get(k) as ContinueEntry), keys};
}

/**
 * Continue entries Home can resume: ones whose reciter is still in the
 * catalog (a card for an unknown reciter has no name and plays nothing).
 */
export function resumableContinue(
  entries: readonly ContinueEntry[],
  isKnownReciter: (id: string) => boolean,
): ContinueEntry[] {
  return entries.filter(e => isKnownReciter(e.reciterId));
}

/**
 * Where focus goes after a menu removed the Home card it was opened from
 * (Remove from Continue listening, Unlike): the card now in its place, or
 * the new last one when it was at the end. `index` is the card's place when
 * the menu opened and `liveKeys` the rail's keys now. Undefined while the
 * card is still there (the menu gives focus back to it); null when the rail
 * is now empty.
 */
export function focusAfterRemoval(
  openedKey: string,
  index: number,
  liveKeys: readonly string[],
): string | null | undefined {
  if (liveKeys.includes(openedKey)) return undefined;
  if (liveKeys.length === 0) return null;
  return liveKeys[Math.min(Math.max(0, index), liveKeys.length - 1)];
}

/**
 * A Continue card's time left: "12 min left", "2 h 14 min left" (written
 * like collection lengths), "40 s left" in the last minute of a short surah,
 * "Almost done" only near the end, or "Started" when the length is unknown.
 */
export function timeLeftLabel(
  entry: Pick<ContinueEntry, 'positionSeconds' | 'durationSeconds'>,
): string {
  if (!(entry.durationSeconds > 0)) return 'Started';
  if (entry.positionSeconds >= entry.durationSeconds * ALMOST_DONE_FRACTION) {
    return 'Almost done';
  }
  const left = entry.durationSeconds - entry.positionSeconds;
  if (left < 60) return `${Math.max(1, Math.round(left))} s left`;
  return `${formatMinutes(left / 60)} left`;
}
