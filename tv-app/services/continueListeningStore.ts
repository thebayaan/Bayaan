import {readJSON, writeJSON, remove} from './storage';

const KEY = 'bayaan_tv_continue';
const MAX_ENTRIES = 10;

export type ContinueEntry = {
  reciterId: string;
  rewayahId: string;
  surahNumber: number;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
};

export type ProgressInput = Omit<ContinueEntry, 'updatedAt'>;

export function getContinueEntries(): ContinueEntry[] {
  return readJSON<ContinueEntry[]>(KEY) ?? [];
}

export function recordProgress(input: ProgressInput): void {
  const now = Date.now();
  const existing = getContinueEntries();
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
