import {readJSON, remove, storage, writeJSON} from './storage';

const KEY = 'bayaan_tv_favorites';

export type FavoriteEntry = {
  reciterId: string;
  addedAt: number;
};

export function getFavorites(): FavoriteEntry[] {
  return readJSON<FavoriteEntry[]>(KEY) ?? [];
}

export function isFavorite(reciterId: string): boolean {
  return getFavorites().some(f => f.reciterId === reciterId);
}

export function toggleFavorite(reciterId: string): boolean {
  const existing = getFavorites();
  const already = existing.some(f => f.reciterId === reciterId);
  if (already) {
    const next = existing.filter(f => f.reciterId !== reciterId);
    writeJSON(KEY, next);
    return false;
  }
  const next: FavoriteEntry[] = [{reciterId, addedAt: Date.now()}, ...existing];
  writeJSON(KEY, next);
  return true;
}

export function clearFavorites(): void {
  remove(KEY);
}

export const FAVORITES_KEY = KEY;
export {storage};
