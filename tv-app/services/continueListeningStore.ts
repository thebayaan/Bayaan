import {readJSON, writeJSON, remove} from './storage';

const KEY = 'bayaan_tv_continue';
const MAX_ENTRIES = 10;

/**
 * Minimum playback position before an entry is worth surfacing in
 * "Continue Listening". Mirrors Spotify: a track barely started should not
 * clutter the resume row, so progress writes below this are ignored and never
 * overwrite a meaningful existing entry.
 */
export const MIN_PROGRESS_SECONDS = 5;

/**
 * A surah counts as finished, and leaves "Continue listening", once it is
 * this far through or this close to the end. The progress writer runs every
 * few seconds, so its last write lands just short of the end; without these
 * thresholds a finished surah would sit there as "Almost done" forever.
 */
export const FINISHED_FRACTION = 0.97;
export const FINISHED_TAIL_SECONDS = 15;

export function isFinishedProgress(
  positionSeconds: number,
  durationSeconds: number,
): boolean {
  if (!(durationSeconds > 0)) return false;
  return (
    positionSeconds >= durationSeconds * FINISHED_FRACTION ||
    positionSeconds >= durationSeconds - FINISHED_TAIL_SECONDS
  );
}

export type ContinueEntry = {
  reciterId: string;
  rewayahId: string;
  surahNumber: number;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
};

export type ProgressInput = Omit<ContinueEntry, 'updatedAt'>;

function readEntries(): ContinueEntry[] {
  return readJSON<ContinueEntry[]>(KEY) ?? [];
}

/** Continue-listening entries, most-recently updated first, unfinished only. */
export function getContinueListening(): ContinueEntry[] {
  return readEntries()
    .filter(e => !isFinishedProgress(e.positionSeconds, e.durationSeconds))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Alias of {@link getContinueListening} kept for existing call sites. */
export function getContinueEntries(): ContinueEntry[] {
  return getContinueListening();
}

export function recordProgress(input: ProgressInput): void {
  if (input.positionSeconds < MIN_PROGRESS_SECONDS) return;
  // Near the end the surah is done: drop it rather than save "Almost done".
  if (isFinishedProgress(input.positionSeconds, input.durationSeconds)) {
    removeContinue(input.reciterId, input.surahNumber);
    return;
  }
  const now = Date.now();
  const existing = readEntries();
  const filtered = existing.filter(
    e =>
      !(e.reciterId === input.reciterId && e.surahNumber === input.surahNumber),
  );
  const next: ContinueEntry = {...input, updatedAt: now};
  filtered.unshift(next);
  filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  writeJSON(KEY, filtered.slice(0, MAX_ENTRIES));
}

/** Drops one surah's entry (a finished track, or "Remove from Continue"). */
export function removeContinue(reciterId: string, surahNumber: number): void {
  const existing = readEntries();
  const next = existing.filter(
    e => !(e.reciterId === reciterId && e.surahNumber === surahNumber),
  );
  if (next.length !== existing.length) writeJSON(KEY, next);
}

export function clearContinue(): void {
  remove(KEY);
}
