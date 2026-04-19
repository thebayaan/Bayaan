import {readJSON, remove, storage, writeJSON} from './storage';

const KEY = 'bayaan_tv_recently_played';
const MAX_ENTRIES = 20;

export type RecentEntry = {
  reciterId: string;
  visitedAt: number;
};

export function getRecent(): RecentEntry[] {
  return readJSON<RecentEntry[]>(KEY) ?? [];
}

export function recordVisit(reciterId: string): void {
  if (!reciterId) return;
  const existing = getRecent();
  const filtered = existing.filter(e => e.reciterId !== reciterId);
  const next: RecentEntry[] = [
    {reciterId, visitedAt: Date.now()},
    ...filtered,
  ].slice(0, MAX_ENTRIES);
  writeJSON(KEY, next);
}

export function clearRecent(): void {
  remove(KEY);
}

export const RECENT_KEY = KEY;
export {storage};
