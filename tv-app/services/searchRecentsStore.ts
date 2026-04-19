import {readJSON, remove, storage, writeJSON} from './storage';

const KEY = 'bayaan_tv_search_recents';
const MAX_ENTRIES = 8;

export function getRecentSearches(): string[] {
  return readJSON<string[]>(KEY) ?? [];
}

export function recordSearch(query: string): void {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  const existing = getRecentSearches();
  const filtered = existing.filter(
    q => q.toLowerCase() !== trimmed.toLowerCase(),
  );
  const next = [trimmed, ...filtered].slice(0, MAX_ENTRIES);
  writeJSON(KEY, next);
}

export function clearRecentSearches(): void {
  remove(KEY);
}

export const SEARCH_RECENTS_KEY = KEY;
export {storage};
