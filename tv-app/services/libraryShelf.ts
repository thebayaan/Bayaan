// The Library shelf: what the listener chose to keep (playlists, loved
// surahs, favourite reciters), as tabs of same-size tiles. History
// (continue listening, recently played) lives on Home, never here. Pure
// rules (merge, sort, tabs, counts, captions) so the screen only draws what
// this returns.
import type {FavoriteEntry} from './favoritesStore';
import type {LovedSurah} from './lovedSurahsStore';
import type {Playlist} from './playlistsStore';
import {rewayahFamily, rewayahShortName} from './browseCatalog';

/** A playlist, drawn in its colour with its first surah. */
export type ShelfPlaylist = {
  kind: 'playlist';
  key: string;
  playlistId: string;
  name: string;
  /** Last changed, ms since epoch. */
  at: number;
};

/** A surah loved in one reciter's voice. */
export type ShelfSurah = {
  kind: 'surah';
  key: string;
  surahNumber: number;
  reciterId: string;
  rewayahId: string;
  /** When it was loved, ms since epoch. */
  at: number;
};

/** A favourite reciter. */
export type ShelfReciter = {
  kind: 'reciter';
  key: string;
  reciterId: string;
  /** How many loved surahs on the shelf are in this reciter's voice. */
  surahCount: number;
  at: number;
};

/** The Playlists tab's first tile, always there: making one is one press. */
export type ShelfNewPlaylist = {kind: 'new'; key: 'new'; at: number};

export type ShelfItem =
  | ShelfPlaylist
  | ShelfSurah
  | ShelfReciter
  | ShelfNewPlaylist;

export type ShelfFilter = 'playlists' | 'loved' | 'reciters';
export type ShelfSort = 'recent' | 'az';

export const NEW_PLAYLIST_TILE: ShelfNewPlaylist = {
  kind: 'new',
  key: 'new',
  at: Number.MAX_SAFE_INTEGER,
};

export type ShelfSources = {
  playlists: readonly Playlist[];
  loved: readonly LovedSurah[];
  favorites: readonly FavoriteEntry[];
  /** Reciters the app can play; entries for anyone else are left out. */
  isKnownReciter?: (reciterId: string) => boolean;
};

export type Shelf = Record<
  ShelfFilter,
  Array<ShelfPlaylist | ShelfSurah | ShelfReciter>
>;

function finite(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/**
 * The three tabs, each newest first:
 * - playlists, by when they last changed;
 * - one tile per loved surah + reciter;
 * - favourite reciters, each with a count of its loved surahs.
 */
export function buildShelf(sources: ShelfSources): Shelf {
  const known = sources.isKnownReciter ?? (() => true);

  const playlists: ShelfPlaylist[] = sources.playlists
    .filter(p => p && typeof p.id === 'string')
    .map(p => ({
      kind: 'playlist',
      key: `p:${p.id}`,
      playlistId: p.id,
      name: p.name,
      at: finite(p.updatedAt),
    }));

  const loved = new Map<string, ShelfSurah>();
  for (const l of sources.loved) {
    if (!l || !l.reciterId || !known(l.reciterId)) continue;
    const key = `s:${l.surahNumber}:${l.reciterId}`;
    const at = finite(l.addedAt);
    const existing = loved.get(key);
    if (existing && existing.at >= at) continue;
    loved.set(key, {
      kind: 'surah',
      key,
      surahNumber: l.surahNumber,
      reciterId: l.reciterId,
      rewayahId: l.rewayahId ?? '',
      at,
    });
  }

  const surahCount = new Map<string, number>();
  for (const s of loved.values()) {
    surahCount.set(s.reciterId, (surahCount.get(s.reciterId) ?? 0) + 1);
  }

  const reciters = new Map<string, ShelfReciter>();
  for (const f of sources.favorites) {
    if (!f || !f.reciterId || !known(f.reciterId)) continue;
    const at = finite(f.addedAt);
    const existing = reciters.get(f.reciterId);
    if (existing) {
      existing.at = Math.max(existing.at, at);
      continue;
    }
    reciters.set(f.reciterId, {
      kind: 'reciter',
      key: `r:${f.reciterId}`,
      reciterId: f.reciterId,
      surahCount: surahCount.get(f.reciterId) ?? 0,
      at,
    });
  }

  return {
    playlists: sortShelf(playlists, 'recent'),
    loved: sortShelf([...loved.values()], 'recent'),
    reciters: sortShelf([...reciters.values()], 'recent'),
  };
}

/** Newest first, or A to Z by the name `nameOf` gives each tile. */
export function sortShelf<T extends ShelfItem>(
  items: readonly T[],
  sort: ShelfSort,
  nameOf?: (item: T) => string,
): T[] {
  const indexed = items.map((item, i) => ({item, i}));
  if (sort === 'az' && nameOf) {
    const names = new Map(items.map(item => [item.key, nameOf(item)]));
    indexed.sort(
      (a, b) =>
        (names.get(a.item.key) ?? '').localeCompare(
          names.get(b.item.key) ?? '',
          'en',
          {sensitivity: 'base'},
        ) ||
        b.item.at - a.item.at ||
        a.i - b.i,
    );
  } else {
    // Stable: equal times keep their order.
    indexed.sort((a, b) => b.item.at - a.item.at || a.i - b.i);
  }
  return indexed.map(x => x.item);
}

/** One tab's tiles in order; the Playlists tab always starts with New. */
export function tabItems(
  shelf: Shelf,
  filter: ShelfFilter,
  sort: ShelfSort,
  nameOf?: (item: ShelfItem) => string,
): ShelfItem[] {
  const sorted: ShelfItem[] = sortShelf(shelf[filter], sort, nameOf);
  return filter === 'playlists' ? [NEW_PLAYLIST_TILE, ...sorted] : sorted;
}

export function shelfCounts(shelf: Shelf): Record<ShelfFilter, number> {
  return {
    playlists: shelf.playlists.length,
    loved: shelf.loved.length,
    reciters: shelf.reciters.length,
  };
}

/** Whether nothing at all is kept yet (the Library's first run). */
export function isShelfEmpty(shelf: Shelf): boolean {
  return (
    shelf.playlists.length === 0 &&
    shelf.loved.length === 0 &&
    shelf.reciters.length === 0
  );
}

/** "3 loved surahs", "1 loved surah", or "Reciter". */
export function reciterTileLabel(surahCount: number): string {
  if (surahCount <= 0) return 'Reciter';
  return `${surahCount} loved ${surahCount === 1 ? 'surah' : 'surahs'}`;
}

/**
 * The line under a loved surah: the voice, and the rewayah when it is not
 * Hafs ("Abdulbasit · Warsh"). The heart is drawn beside it.
 */
export function surahTileCaption(
  reciterName: string,
  rewayahName?: string | null,
): string {
  const parts: string[] = [];
  if (reciterName) parts.push(reciterName);
  if (rewayahName && rewayahFamily(rewayahName) !== 'hafs') {
    parts.push(rewayahShortName(rewayahName));
  }
  return parts.join(' · ');
}

/** "1 surah", "12 surahs" or "Empty". */
export function surahCountLabel(count: number): string {
  if (count <= 0) return 'Empty';
  return `${count} ${count === 1 ? 'surah' : 'surahs'}`;
}

/**
 * The line under a playlist: its size, and its voice when it has one
 * ("12 surahs · Al-Minshawi") or how many it mixes ("5 surahs · 3 reciters").
 * `voiceOf` gives a reciter's short name.
 */
export function playlistCaption(
  items: ReadonlyArray<{reciterId: string}>,
  voiceOf: (reciterId: string) => string,
): string {
  const size = surahCountLabel(items.length);
  const voices = new Set(items.map(i => i.reciterId));
  if (voices.size === 0) return size;
  if (voices.size === 1) {
    const voice = voiceOf(items[0].reciterId);
    return voice ? `${size} · ${voice}` : size;
  }
  return `${size} · ${voices.size} reciters`;
}
