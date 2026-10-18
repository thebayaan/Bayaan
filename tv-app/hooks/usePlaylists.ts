import {useSyncExternalStore} from 'react';
import {
  PLAYLISTS_KEY,
  getPlaylists,
  storage,
  type Playlist,
} from '../services/playlistsStore';

let cachedSnapshot: Playlist[] = [];
let cachedRaw: string | undefined;

function getSnapshot(): Playlist[] {
  const raw = storage.getString(PLAYLISTS_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = getPlaylists();
  return cachedSnapshot;
}

function subscribe(cb: () => void): () => void {
  const listener = storage.addOnValueChangedListener(key => {
    if (key === PLAYLISTS_KEY) cb();
  });
  return () => listener.remove();
}

/** The listener's playlists, most recently changed first, live. */
export function usePlaylists(): Playlist[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** One playlist, live; null once it has been deleted. */
export function usePlaylist(id: string | undefined): Playlist | null {
  const all = usePlaylists();
  return id ? (all.find(p => p.id === id) ?? null) : null;
}
