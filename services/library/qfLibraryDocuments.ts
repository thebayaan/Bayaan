// @ai-generated
import type {LibraryCollection} from '@/services/settings/bayaanSettingsApiClient';
import type {LibraryEntries} from './qfLibraryMerge';

/**
 * Wire shapes of Bayaan's library App State documents. These must match the
 * BFF allowlist in bayaan-backend `src/routes/v1/qfLibraryDocuments.ts`;
 * docs/architecture/sync-registry.md lists every synced field.
 *
 * - library/reciters:  {v: [[reciterId, favoritedAt], ...]}
 * - library/loved-N:   {v: [[reciterId, rewayatId, lovedAt], ...]} (surah N)
 * - playlists/<id>:    {name, color, description, createdAt, items}
 * - adhkar/saved:      {v: [[dhikrId, savedAt], ...]}
 */

export interface LibraryDocumentCodec {
  /** Entries for a value, or undefined when this version can't read it. */
  decode(value: unknown): LibraryEntries | undefined;
  encode(entries: LibraryEntries): unknown;
}

const ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const OPTIONAL_ID = /^[A-Za-z0-9_.:-]{0,128}$/;
const PLAYLIST_KEY = /^[A-Za-z0-9_-]{1,64}$/;
// Keep in step with the BFF caps.
const MAX_FAVORITE_RECITERS = 500;
const MAX_LOVED_PER_SURAH = 500;
const MAX_PLAYLIST_ITEMS = 500;
const MAX_SAVED_ADHKAR = 2_000;
export const MAX_LIBRARY_DOCUMENT_BYTES = 16 * 1024;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const names = Object.keys(value);
  return (
    names.length === keys.length && names.every(name => keys.includes(name))
  );
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function isLibraryId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

function isOptionalId(value: unknown): value is string {
  return typeof value === 'string' && OPTIONAL_ID.test(value);
}

function byTime(entries: LibraryEntries): [string, number][] {
  return Object.entries(entries)
    .map(([key, time]) => [key, Number(time)] as [string, number])
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
}

/** `{v: [[id, time], ...]}` as `{id: "time"}`. */
function idTimeCodec(max: number): LibraryDocumentCodec {
  return {
    decode(value) {
      if (!isObject(value) || !hasExactKeys(value, ['v'])) return undefined;
      if (!Array.isArray(value.v) || value.v.length > max) return undefined;
      const entries: Record<string, string> = {};
      for (const entry of value.v) {
        if (
          !Array.isArray(entry) ||
          entry.length !== 2 ||
          !isLibraryId(entry[0]) ||
          !isTimestamp(entry[1]) ||
          entry[0] in entries
        ) {
          return undefined;
        }
        entries[entry[0]] = String(entry[1]);
      }
      return entries;
    },
    encode(entries) {
      return {v: byTime(entries).map(([id, time]) => [id, time])};
    },
  };
}

/** Loved tracks of one surah are keyed `reciterId|rewayatId`. */
export function lovedEntryKey(reciterId: string, rewayatId: string): string {
  return `${reciterId}|${rewayatId}`;
}

export function splitLovedEntryKey(key: string): [string, string] {
  const at = key.indexOf('|');
  return [key.slice(0, at), key.slice(at + 1)];
}

const lovedCodec: LibraryDocumentCodec = {
  decode(value) {
    if (!isObject(value) || !hasExactKeys(value, ['v'])) return undefined;
    if (!Array.isArray(value.v) || value.v.length > MAX_LOVED_PER_SURAH) {
      return undefined;
    }
    const entries: Record<string, string> = {};
    for (const entry of value.v) {
      if (
        !Array.isArray(entry) ||
        entry.length !== 3 ||
        !isLibraryId(entry[0]) ||
        !isOptionalId(entry[1]) ||
        !isTimestamp(entry[2])
      ) {
        return undefined;
      }
      const key = lovedEntryKey(entry[0], entry[1]);
      if (key in entries) return undefined;
      entries[key] = String(entry[2]);
    }
    return entries;
  },
  encode(entries) {
    return {
      v: byTime(entries).map(([key, time]) => [
        ...splitLovedEntryKey(key),
        time,
      ]),
    };
  },
};

export interface PlaylistDocument {
  name: string;
  color: string;
  description: string | null;
  createdAt: number;
  /** `[surahId, reciterId, rewayatId]` in play order. */
  items: [number, string, string][];
}

/**
 * A playlist's fields merge one by one; its item list is one field, so the
 * last edit to the order or contents wins as a whole.
 */
export function playlistEntries(playlist: PlaylistDocument): LibraryEntries {
  return {
    name: playlist.name,
    color: playlist.color,
    description: JSON.stringify(playlist.description),
    createdAt: String(playlist.createdAt),
    items: JSON.stringify(playlist.items),
  };
}

function validPlaylist(value: unknown): value is PlaylistDocument {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ['name', 'color', 'description', 'createdAt', 'items'])
  ) {
    return false;
  }
  return (
    typeof value.name === 'string' &&
    value.name.length >= 1 &&
    value.name.length <= 200 &&
    typeof value.color === 'string' &&
    value.color.length >= 1 &&
    value.color.length <= 32 &&
    (value.description === null ||
      (typeof value.description === 'string' &&
        value.description.length <= 1_000)) &&
    isTimestamp(value.createdAt) &&
    Array.isArray(value.items) &&
    value.items.length <= MAX_PLAYLIST_ITEMS &&
    value.items.every(
      item =>
        Array.isArray(item) &&
        item.length === 3 &&
        Number.isInteger(item[0]) &&
        item[0] >= 1 &&
        item[0] <= 114 &&
        isLibraryId(item[1]) &&
        isOptionalId(item[2]),
    )
  );
}

export function decodePlaylistEntries(
  entries: LibraryEntries,
): PlaylistDocument | undefined {
  try {
    const playlist = {
      name: entries.name,
      color: entries.color,
      description: JSON.parse(entries.description ?? 'undefined'),
      createdAt: Number(entries.createdAt),
      items: JSON.parse(entries.items ?? 'undefined'),
    };
    return validPlaylist(playlist) ? playlist : undefined;
  } catch {
    return undefined;
  }
}

const playlistCodec: LibraryDocumentCodec = {
  decode(value) {
    return validPlaylist(value) ? playlistEntries(value) : undefined;
  },
  encode(entries) {
    const playlist = decodePlaylistEntries(entries);
    if (!playlist) throw new Error('Invalid playlist entries');
    return playlist;
  },
};

const recitersCodec = idTimeCodec(MAX_FAVORITE_RECITERS);
const savedAdhkarCodec = idTimeCodec(MAX_SAVED_ADHKAR);

export function lovedDocumentKey(surahNumber: number): string {
  return `loved-${surahNumber}`;
}

export function lovedDocumentSurah(key: string): number | undefined {
  const match = /^loved-([1-9]\d{0,2})$/.exec(key);
  const surah = match ? Number(match[1]) : NaN;
  return surah >= 1 && surah <= 114 ? surah : undefined;
}

/** The codec for a document key, or undefined for keys Bayaan doesn't use. */
export function libraryCodec(
  collection: LibraryCollection,
  key: string,
): LibraryDocumentCodec | undefined {
  if (collection === 'library') {
    if (key === 'reciters') return recitersCodec;
    return lovedDocumentSurah(key) ? lovedCodec : undefined;
  }
  if (collection === 'playlists') {
    return PLAYLIST_KEY.test(key) ? playlistCodec : undefined;
  }
  return key === 'saved' ? savedAdhkarCodec : undefined;
}

/** Whether an encoded document fits App State's per-document limit. */
export function fitsDocumentLimit(value: unknown): boolean {
  return (
    utf8Length(JSON.stringify({value, schemaVersion: 1})) <=
    MAX_LIBRARY_DOCUMENT_BYTES
  );
}

function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}
