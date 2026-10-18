import {readJSON, remove, storage, writeJSON} from './storage';

const KEY = 'bayaan_tv_playlists';
export const MAX_PLAYLISTS = 50;
export const MAX_PLAYLIST_ITEMS = 200;

/**
 * One surah in a playlist, in the voice it was added in. Mirrors the phone's
 * playlist items (services/playlist: surahId + reciterId + rewayatId), with
 * the surah as a number since the TV keys surahs that way everywhere.
 */
export type PlaylistItem = {
  surahNumber: number;
  reciterId: string;
  rewayahId?: string;
};

export type Playlist = {
  id: string;
  name: string;
  /** A hex color, like the phone's playlist color. */
  color?: string;
  items: PlaylistItem[];
  createdAt: number;
  updatedAt: number;
};

function isItem(value: unknown): value is PlaylistItem {
  const v = value as PlaylistItem | null;
  return (
    v !== null &&
    typeof v === 'object' &&
    Number.isInteger(v.surahNumber) &&
    v.surahNumber >= 1 &&
    v.surahNumber <= 114 &&
    typeof v.reciterId === 'string' &&
    (v.rewayahId === undefined || typeof v.rewayahId === 'string')
  );
}

function sameItem(a: PlaylistItem, b: PlaylistItem): boolean {
  return (
    a.surahNumber === b.surahNumber &&
    a.reciterId === b.reciterId &&
    (a.rewayahId ?? '') === (b.rewayahId ?? '')
  );
}

function readAll(): Playlist[] {
  const saved = readJSON<Playlist[]>(KEY);
  if (!Array.isArray(saved)) return [];
  return saved
    .filter(
      p =>
        p !== null &&
        typeof p === 'object' &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        Array.isArray(p.items),
    )
    .map(p => ({...p, items: p.items.filter(isItem)}));
}

function writeAll(playlists: Playlist[]): void {
  writeJSON(KEY, playlists);
}

/** Applies `change` to one playlist and stamps it; false when it's gone. */
function update(id: string, change: (p: Playlist) => Playlist): boolean {
  const all = readAll();
  const at = all.findIndex(p => p.id === id);
  if (at < 0) return false;
  all[at] = {...change(all[at]), updatedAt: Date.now()};
  writeAll(all);
  return true;
}

/** Playlists, most recently changed first. */
export function getPlaylists(): Playlist[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPlaylist(id: string): Playlist | null {
  return readAll().find(p => p.id === id) ?? null;
}

/** A playlist's name after trimming; empty names fall back to a default. */
export function cleanPlaylistName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  return trimmed.length > 0 ? trimmed : 'My playlist';
}

let lastId = 0;

/** Creates a playlist and returns its id; duplicate items are dropped. */
export function createPlaylist(
  name: string,
  items: PlaylistItem[] = [],
  color?: string,
): string {
  // Same id shape as the phone (`playlist_<ms>`), kept unique within a ms.
  const now = Date.now();
  lastId = Math.max(now, lastId + 1);
  const id = `playlist_${lastId}`;
  const unique: PlaylistItem[] = [];
  for (const item of items.filter(isItem)) {
    if (!unique.some(u => sameItem(u, item))) unique.push(item);
  }
  const playlist: Playlist = {
    id,
    name: cleanPlaylistName(name),
    ...(color ? {color} : {}),
    items: unique.slice(0, MAX_PLAYLIST_ITEMS),
    createdAt: now,
    updatedAt: now,
  };
  writeAll([playlist, ...readAll()].slice(0, MAX_PLAYLISTS));
  return id;
}

export function renamePlaylist(id: string, name: string): boolean {
  return update(id, p => ({...p, name: cleanPlaylistName(name)}));
}

export function setPlaylistColor(
  id: string,
  color: string | undefined,
): boolean {
  return update(id, p => {
    const {color: _old, ...rest} = p;
    return color ? {...rest, color} : rest;
  });
}

export function removePlaylist(id: string): void {
  writeAll(readAll().filter(p => p.id !== id));
}

/** Adds a surah to the end; false when it is already there (or no room). */
export function addPlaylistItem(id: string, item: PlaylistItem): boolean {
  if (!isItem(item)) return false;
  let added = false;
  const found = update(id, p => {
    if (p.items.some(i => sameItem(i, item))) return p;
    if (p.items.length >= MAX_PLAYLIST_ITEMS) return p;
    added = true;
    return {...p, items: [...p.items, item]};
  });
  return found && added;
}

export function hasPlaylistItem(id: string, item: PlaylistItem): boolean {
  return getPlaylist(id)?.items.some(i => sameItem(i, item)) ?? false;
}

/** Removes an item by its position, or by surah + reciter (+ rewayah). */
export function removePlaylistItem(
  id: string,
  target: number | PlaylistItem,
): boolean {
  return update(id, p => ({
    ...p,
    items: p.items.filter((it, i) =>
      typeof target === 'number' ? i !== target : !sameItem(it, target),
    ),
  }));
}

/** Moves the item at `from` to `to` (both clamped to the list). */
export function movePlaylistItem(
  id: string,
  from: number,
  to: number,
): boolean {
  return update(id, p => {
    if (from < 0 || from >= p.items.length) return p;
    const items = p.items.slice();
    const [moved] = items.splice(from, 1);
    const target = Math.max(0, Math.min(items.length, to));
    items.splice(target, 0, moved);
    return {...p, items};
  });
}

export function clearPlaylists(): void {
  remove(KEY);
}

/** The store's API in one object, for screens that pass it around. */
export const playlistsStore = {
  getAll: getPlaylists,
  get: getPlaylist,
  create: createPlaylist,
  rename: renamePlaylist,
  setColor: setPlaylistColor,
  remove: removePlaylist,
  addItem: addPlaylistItem,
  hasItem: hasPlaylistItem,
  removeItem: removePlaylistItem,
  moveItem: movePlaylistItem,
  clear: clearPlaylists,
};

export const PLAYLISTS_KEY = KEY;
export {storage};
