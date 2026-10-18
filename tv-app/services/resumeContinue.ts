/**
 * Resuming the newest Continue listening entry: what the sidebar tile offers
 * after a relaunch ("Continue"), and what the remote's Play/Pause does then,
 * so the key never does nothing while the tile offers to continue.
 */
import {getContinueListening, type ContinueEntry} from './continueListeningStore';
import {newestResumable} from './nowPlayingTile';
import {playOrOpen} from './playbackRouting';
import {getCachedReciter, getCachedReciters} from './tvDataService';

// Before the catalog is cached there is no telling: the entry stands.
const isKnownReciter = (id: string): boolean =>
  getCachedReciters() === null || getCachedReciter(id) !== undefined;

/** The entry the tile shows and resumes (Home's first Continue card). */
export function newestContinue(
  entries: readonly ContinueEntry[],
): ContinueEntry | null {
  return newestResumable(entries, isKnownReciter);
}

/** Resumes `entry` where it was left, opening the player. */
export function resumeContinue(entry: ContinueEntry, source: string): void {
  void playOrOpen({
    reciterId: entry.reciterId,
    rewayahId: entry.rewayahId,
    surahNumber: entry.surahNumber,
    startSeconds: entry.positionSeconds,
    source,
  });
}

/** Resumes the newest resumable entry; false when there is none. */
export function resumeNewestContinue(source: string): boolean {
  const entry = newestContinue(getContinueListening());
  if (!entry) return false;
  resumeContinue(entry, source);
  return true;
}
