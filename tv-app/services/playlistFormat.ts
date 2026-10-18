// How playlists look and are named on TV, matching the phone's create sheet
// (components/sheets/CreatePlaylistSheet.tsx): the same twelve colours, the
// first unused one picked for a new playlist. The stored hex stays the
// phone's; the TV draws each one as a muted pigment (playlistTint) so it sits
// with the surah art (Ink & Cream).
import type {Playlist} from './playlistsStore';
import {deleteKey, typeKey, typeSpace} from './search/keyboard';

/** The phone's playlist colours, each with the name it is read out as. */
const COLORS: ReadonlyArray<{hex: string; name: string}> = [
  {hex: '#6366F1', name: 'Indigo'},
  {hex: '#8B5CF6', name: 'Purple'},
  {hex: '#EC4899', name: 'Pink'},
  {hex: '#EF4444', name: 'Red'},
  {hex: '#F97316', name: 'Orange'},
  {hex: '#EAB308', name: 'Yellow'},
  {hex: '#22C55E', name: 'Green'},
  {hex: '#06B6D4', name: 'Cyan'},
  {hex: '#3B82F6', name: 'Blue'},
  {hex: '#84CC16', name: 'Lime'},
  {hex: '#F59E0B', name: 'Amber'},
  {hex: '#10B981', name: 'Emerald'},
];

export const PLAYLIST_COLORS: readonly string[] = COLORS.map(c => c.hex);

/** Colour for a playlist saved without one (older data). */
export const FALLBACK_PLAYLIST_COLOR = PLAYLIST_COLORS[0];

/** "Indigo" for '#6366F1' (any case); "Colour" for one not in the set. */
export function playlistColorName(hex: string): string {
  const upper = hex.trim().toUpperCase();
  return COLORS.find(c => c.hex === upper)?.name ?? 'Colour';
}

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

/**
 * `name`, or "name 2", "name 3"... when another playlist (not `exceptId`, the
 * one being renamed) already has it, so pickers can tell them apart.
 */
export function uniquePlaylistName(
  name: string,
  playlists: readonly Playlist[],
  exceptId?: string,
): string {
  const taken = new Set(
    playlists
      .filter(p => p.id !== exceptId)
      .map(p => p.name.trim().toLowerCase()),
  );
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const next = `${name} ${n}`;
    if (!taken.has(next.toLowerCase())) return next;
  }
}

type RGB = [number, number, number];

/** The app's ink (colors.backgroundSecondary), the colour art fades into. */
const INK: RGB = [0x06, 0x15, 0x1c];

function parseHex(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const value = parseInt(m ? m[1] : FALLBACK_PLAYLIST_COLOR.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(rgb: RGB): string {
  return `#${rgb
    .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16))
    .map(v => v.padStart(2, '0'))
    .join('')}`;
}

/** `amount` of `a` over the rest of `b`, per channel. */
function mix(a: RGB, b: RGB, amount: number): RGB {
  return [
    a[0] * amount + b[0] * (1 - amount),
    a[1] * amount + b[1] * (1 - amount),
    a[2] * amount + b[2] * (1 - amount),
  ];
}

/**
 * How the TV draws a playlist colour: the phone's bright UI colour taken 40%
 * toward its own grey and 28% into the ink, which lands it beside the surah
 * pigments (theme/surahColors PIGMENTS) in depth and strength. Used for the
 * swatches and the art alike, so what you pick is what you get.
 */
export function playlistTint(color?: string): string {
  const rgb = parseHex(color ?? FALLBACK_PLAYLIST_COLOR);
  const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return toHex(mix(mix(rgb, [luma, luma, luma], 0.6), INK, 0.72));
}

/**
 * A playlist's art gradient: its tint fading into the app's ink. Both stops
 * are opaque, premixed with the ink: react-native-svg takes a stop's opacity
 * from stopOpacity only and drops an rgba colour's alpha, which drew the art
 * as one flat, fully saturated block.
 */
export function playlistGradient(color?: string): [string, string] {
  const tint = parseHex(playlistTint(color));
  return [toHex(tint), toHex(mix(tint, INK, 0.4))];
}

/**
 * A playlist name being typed on the grid keyboard. A prefilled name is
 * `fresh`: the first letter replaces it, so Save works at once and typing a
 * new name costs no deletes. Delete and space edit it instead (fixing the
 * last letter of a name being renamed, or adding a word); the clear key
 * empties it. The keyboard has no shift, so a name's first letter is
 * capitalised ("Fajr"), like the suggested names and the phone's.
 */
export type NameDraft = {text: string; fresh: boolean};

export function draftKey(draft: NameDraft, key: string): NameDraft {
  const text = draft.fresh ? '' : draft.text;
  return {
    text: typeKey(text, text.length === 0 ? key.toUpperCase() : key),
    fresh: false,
  };
}

export function draftSpace(draft: NameDraft): NameDraft {
  return {text: typeSpace(draft.text), fresh: false};
}

export function draftDelete(draft: NameDraft): NameDraft {
  return {text: deleteKey(draft.text), fresh: false};
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** Whether a name holds Arabic letters (it is then laid out right to left). */
export function isArabicText(text: string): boolean {
  return ARABIC.test(text);
}
