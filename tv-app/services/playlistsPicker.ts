// The one add-to-playlist model, shared by the surah menu's picker page and
// the player's Save panel so both read and answer the same way: the same
// labels, the same detail line, and a toast for every add or removal (a stray
// OK on a ticked row never takes a surah out silently).
import {surahCountLabel} from './libraryShelf';
import {
  MAX_PLAYLISTS,
  addPlaylistItem,
  getPlaylists,
  removePlaylistItem,
  type PlaylistItem,
} from './playlistsStore';
import {showToast} from '../store/toastStore';

/** The picker's first row, which opens the editor seeded with the surah. */
export const NEW_PLAYLIST_LABEL = 'New playlist';
export const NEW_PLAYLIST_DETAIL = 'Starts with this surah';

/** A playlist row's detail: "Empty", "1 surah", "12 surahs". */
export function pickerDetail(playlist: {items: readonly unknown[]}): string {
  return surahCountLabel(playlist.items.length);
}

/**
 * OK on a picker row: takes the surah out when the playlist has it, else
 * adds it, and says which happened. Returns whether the playlist now has it.
 */
export function togglePlaylistItem(
  playlist: {id: string; name: string},
  item: PlaylistItem,
  has: boolean,
): boolean {
  if (has) {
    removePlaylistItem(playlist.id, item);
    showToast(`Removed from ${playlist.name}`);
    return false;
  }
  if (addPlaylistItem(playlist.id, item)) {
    showToast(`Added to ${playlist.name}`);
    return true;
  }
  showToast(`${playlist.name} is full`, 'error');
  return false;
}

/** A playlist row's "Remove from playlist" (the playlist screen's menu). */
export function removeFromPlaylist(
  playlist: {id: string; name: string},
  index: number,
): void {
  removePlaylistItem(playlist.id, index);
  showToast(`Removed from ${playlist.name}`);
}

// The player's Save panel opened the editor. The player unmounts under it
// (it owns play/pause, see navShell.stackLayers), so on the way back it
// raises its tray again with focus on Save rather than starting over.
let backToSave = false;

/** The Save panel is opening the playlist editor. */
export function noteEditorFromSave(): void {
  backToSave = true;
}

/** Whether the player is coming back from that editor (kept until taken). */
export function returningToSave(): boolean {
  return backToSave;
}

/** The same, once: the tray takes it to focus its Save tool. */
export function takeReturnToSave(): boolean {
  const was = backToSave;
  backToSave = false;
  return was;
}

/**
 * Whether another playlist fits; at the cap it says so before the editor
 * opens, so no name is typed for nothing. Every "New playlist" asks this.
 */
export function roomForPlaylist(count = getPlaylists().length): boolean {
  if (count < MAX_PLAYLISTS) return true;
  showToast(
    `You have ${MAX_PLAYLISTS} playlists, the most this TV keeps. Delete one first.`,
    'error',
  );
  return false;
}
