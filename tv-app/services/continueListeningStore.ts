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

/** Continue-listening entries, most-recently updated first. */
export function getContinueListening(): ContinueEntry[] {
  return readEntries().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Alias of {@link getContinueListening} kept for existing call sites. */
export function getContinueEntries(): ContinueEntry[] {
  return getContinueListening();
}

export function recordProgress(input: ProgressInput): void {
  if (input.positionSeconds < MIN_PROGRESS_SECONDS) return;
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

export function clearContinue(): void {
  remove(KEY);
}
