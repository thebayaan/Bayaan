/**
 * A tiny signal for library edits that don't go through a Zustand store the
 * sync can watch (playlists and saved adhkar live in SQLite). Stores call
 * `markLibraryEdited()` after a user edit; account sync listens.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function markLibraryEdited(): void {
  for (const listener of [...listeners]) listener();
}

export function onLibraryEdited(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
