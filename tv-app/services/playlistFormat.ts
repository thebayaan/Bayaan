// How playlists look and are named on TV, matching the phone's create sheet
// (components/sheets/CreatePlaylistSheet.tsx): the same twelve colours, the
// first unused one picked for a new playlist.
import type {Playlist} from './playlistsStore';
import {deleteKey, typeKey, typeSpace} from './search/keyboard';

export const PLAYLIST_COLORS: readonly string[] = [
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#84CC16', // Lime
  '#F59E0B', // Amber
  '#10B981', // Emerald
];

/** Colour for a playlist saved without one (older data). */
export const FALLBACK_PLAYLIST_COLOR = PLAYLIST_COLORS[0];

/** The first colour no playlist uses yet; the cycle restarts when all are. */
export function nextPlaylistColor(playlists: readonly Playlist[]): string {
  const used = new Set(playlists.map(p => p.color?.toUpperCase()));
  return (
    PLAYLIST_COLORS.find(c => !used.has(c)) ??
    PLAYLIST_COLORS[playlists.length % PLAYLIST_COLORS.length]
  );
}

/** "Playlist 1", "Playlist 2"...: the first number no playlist has. */
export function nextPlaylistName(playlists: readonly Playlist[]): string {
  const taken = new Set(playlists.map(p => p.name.trim().toLowerCase()));
  for (let n = playlists.length + 1; ; n++) {
    const name = `Playlist ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/** A hex colour at an opacity, as rgba(). Invalid input falls back. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const value = parseInt(m ? m[1] : FALLBACK_PLAYLIST_COLOR.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * A playlist's art gradient: its colour fading into the app's ink, so a
 * bright colour still sits quietly beside the surah tiles.
 */
export function playlistGradient(color?: string): [string, string] {
  const base = color ?? FALLBACK_PLAYLIST_COLOR;
  return [withAlpha(base, 0.72), withAlpha(base, 0.16)];
}

/**
 * A playlist name being typed on the grid keyboard. A prefilled name is
 * `fresh`: the first key replaces it (delete or space empty it), so Save
 * works at once and typing a new name costs no deletes.
 */
export type NameDraft = {text: string; fresh: boolean};

export function draftKey(draft: NameDraft, key: string): NameDraft {
  return {text: typeKey(draft.fresh ? '' : draft.text, key), fresh: false};
}

export function draftSpace(draft: NameDraft): NameDraft {
  return {text: draft.fresh ? '' : typeSpace(draft.text), fresh: false};
}

export function draftDelete(draft: NameDraft): NameDraft {
  return {text: draft.fresh ? '' : deleteKey(draft.text), fresh: false};
}
