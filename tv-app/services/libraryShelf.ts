// The Library shelf: everything the listener has kept, as one list of
// same-size tiles. Pure rules (merge, sort, filter, counts) so the screen
// only draws what this returns.
import type {ContinueEntry} from './continueListeningStore';
import type {FavoriteEntry} from './favoritesStore';
import type {LovedSurah} from './lovedSurahsStore';
import type {RecentEntry} from './recentlyPlayedStore';
import {rewayahFamily, rewayahShortName} from './browseCatalog';
import {timeLeftLabel} from './libraryFormat';

/** A surah in one reciter's voice: started, loved, or both. */
export type ShelfSurah = {
  kind: 'surah';
  key: string;
  surahNumber: number;
  reciterId: string;
  rewayahId: string;
  loved: boolean;
  /** Where listening stopped, when the surah is unfinished. */
  progress: {positionSeconds: number; durationSeconds: number} | null;
  /** Newest activity (last listened or loved), ms since epoch. */
  at: number;
};

/** A reciter played lately or kept as a favorite. */
export type ShelfReciter = {
  kind: 'reciter';
  key: string;
  reciterId: string;
  favorite: boolean;
  /** How many surah tiles on the shelf are in this reciter's voice. */
  surahCount: number;
  at: number;
};

export type ShelfItem = ShelfSurah | ShelfReciter;

export type ShelfFilter = 'all' | 'surahs' | 'reciters';
export type ShelfSort = 'recent' | 'az';

export type ShelfSources = {
  continueEntries: readonly ContinueEntry[];
  loved: readonly LovedSurah[];
  recent: readonly RecentEntry[];
  favorites: readonly FavoriteEntry[];
  /** Reciters the app can play; entries for anyone else are left out. */
  isKnownReciter?: (reciterId: string) => boolean;
};

function surahKey(surahNumber: number, reciterId: string): string {
  return `s:${surahNumber}:${reciterId}`;
}

function finite(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/**
 * Merges the stores into one shelf, newest first:
 * - one surah tile per surah + reciter; an unfinished entry wins over a
 *   loved one for the same pair (keeping its progress) and the tile is
 *   marked loved too;
 * - one reciter tile per reciter, from recently played and favorites,
 *   dated by whichever is newer, with a count of their surah tiles.
 */
export function buildShelf(sources: ShelfSources): ShelfItem[] {
  const known = sources.isKnownReciter ?? (() => true);
  const surahs = new Map<string, ShelfSurah>();

  for (const e of sources.continueEntries) {
    if (!e || !e.reciterId || !known(e.reciterId)) continue;
    const key = surahKey(e.surahNumber, e.reciterId);
    const at = finite(e.updatedAt);
    const existing = surahs.get(key);
    // The store keeps one entry per pair; if two slip in, the newest counts.
    if (existing && existing.at >= at) continue;
    surahs.set(key, {
      kind: 'surah',
      key,
      surahNumber: e.surahNumber,
      reciterId: e.reciterId,
      rewayahId: e.rewayahId,
      loved: false,
      progress: {
        positionSeconds: finite(e.positionSeconds),
        durationSeconds: finite(e.durationSeconds),
      },
      at,
    });
  }

  for (const l of sources.loved) {
    if (!l || !l.reciterId || !known(l.reciterId)) continue;
    const key = surahKey(l.surahNumber, l.reciterId);
    const at = finite(l.addedAt);
    const existing = surahs.get(key);
    if (existing) {
      existing.loved = true;
      existing.at = Math.max(existing.at, at);
      continue;
    }
    surahs.set(key, {
      kind: 'surah',
      key,
      surahNumber: l.surahNumber,
      reciterId: l.reciterId,
      rewayahId: l.rewayahId,
      loved: true,
      progress: null,
      at,
    });
  }

  const surahCount = new Map<string, number>();
  for (const s of surahs.values()) {
    surahCount.set(s.reciterId, (surahCount.get(s.reciterId) ?? 0) + 1);
  }

  const reciters = new Map<string, ShelfReciter>();
  const addReciter = (reciterId: string, at: number, favorite: boolean) => {
    if (!reciterId || !known(reciterId)) return;
    const existing = reciters.get(reciterId);
    if (existing) {
      existing.at = Math.max(existing.at, at);
      existing.favorite = existing.favorite || favorite;
      return;
    }
    reciters.set(reciterId, {
      kind: 'reciter',
      key: `r:${reciterId}`,
      reciterId,
      favorite,
      surahCount: surahCount.get(reciterId) ?? 0,
      at,
    });
  };
  for (const r of sources.recent) {
    if (r) addReciter(r.reciterId, finite(r.visitedAt), false);
  }
  for (const f of sources.favorites) {
    if (f) addReciter(f.reciterId, finite(f.addedAt), true);
  }

  return sortShelf([...surahs.values(), ...reciters.values()], 'recent');
}

/** Newest first, or A to Z by the name `nameOf` gives each tile. */
export function sortShelf(
  items: readonly ShelfItem[],
  sort: ShelfSort,
  nameOf?: (item: ShelfItem) => string,
): ShelfItem[] {
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
    // Stable: equal times keep their order (surahs before reciters).
    indexed.sort((a, b) => b.item.at - a.item.at || a.i - b.i);
  }
  return indexed.map(x => x.item);
}

export function filterShelf(
  items: readonly ShelfItem[],
  filter: ShelfFilter,
): ShelfItem[] {
  if (filter === 'surahs') return items.filter(i => i.kind === 'surah');
  if (filter === 'reciters') return items.filter(i => i.kind === 'reciter');
  return items.slice();
}

export function shelfCounts(
  items: readonly ShelfItem[],
): Record<ShelfFilter, number> {
  let surahs = 0;
  for (const i of items) if (i.kind === 'surah') surahs++;
  return {all: items.length, surahs, reciters: items.length - surahs};
}

/** "Reciter · 3 surahs", "Reciter · 1 surah", or "Reciter". */
export function reciterTileLabel(surahCount: number): string {
  if (surahCount <= 0) return 'Reciter';
  return `Reciter · ${surahCount} ${surahCount === 1 ? 'surah' : 'surahs'}`;
}

/**
 * The line under a surah tile: the voice, the rewayah when it is not Hafs,
 * and the time left when unfinished ("Abdulbasit · Warsh · 5 min left").
 * The heart for a loved surah is drawn beside it.
 */
export function surahTileCaption(
  tile: Pick<ShelfSurah, 'progress'>,
  reciterName: string,
  rewayahName?: string | null,
): string {
  const parts: string[] = [];
  if (reciterName) parts.push(reciterName);
  if (rewayahName && rewayahFamily(rewayahName) !== 'hafs') {
    parts.push(rewayahShortName(rewayahName));
  }
  if (tile.progress) parts.push(timeLeftLabel(tile.progress));
  return parts.join(' · ');
}
