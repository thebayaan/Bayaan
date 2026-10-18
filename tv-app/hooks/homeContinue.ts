/**
 * Home's Continue listening rail. The store re-sorts its entries every few
 * seconds while audio plays (the newest write first), which would slide the
 * cards, focused one included, under the user. Home keeps the order it first
 * showed and only updates each card's progress in place; a new entry joins
 * at the end. Pure, so the ordering is unit-tested.
 */
import type {ContinueEntry} from '../services/continueListeningStore';

export function continueKey(entry: {
  reciterId: string;
  surahNumber: number;
}): string {
  return `${entry.reciterId}:${entry.surahNumber}`;
}

/**
 * `entries` in the order of `shownKeys` (the keys Home showed before), then
 * any new ones in the store's order. Entries that left the store (finished,
 * removed) drop out. Returns the entries and the keys to remember.
 */
export function stableContinue(
  shownKeys: readonly string[],
  entries: readonly ContinueEntry[],
): {entries: ContinueEntry[]; keys: string[]} {
  const byKey = new Map(entries.map(e => [continueKey(e), e]));
  const kept = shownKeys.filter(k => byKey.has(k));
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
