import {
  buildShelf,
  isShelfEmpty,
  playlistCaption,
  reciterTileLabel,
  shelfCounts,
  sortShelf,
  surahCountLabel,
  surahTileCaption,
  tabItems,
  type ShelfItem,
  type ShelfReciter,
  type ShelfSources,
} from './libraryShelf';
import type {Playlist} from './playlistsStore';

const none: ShelfSources = {playlists: [], loved: [], favorites: []};

function love(surahNumber: number, reciterId: string, addedAt: number) {
  return {surahNumber, reciterId, rewayahId: `${reciterId}-warsh`, addedAt};
}

function fav(reciterId: string, addedAt: number) {
  return {reciterId, addedAt};
}

function list(id: string, name: string, updatedAt: number): Playlist {
  return {id, name, items: [], createdAt: 0, updatedAt};
}

const keys = (items: ShelfItem[]) => items.map(i => i.key);

describe('buildShelf', () => {
  it('is empty with nothing kept', () => {
    const shelf = buildShelf(none);
    expect(isShelfEmpty(shelf)).toBe(true);
    expect(shelfCounts(shelf)).toEqual({playlists: 0, loved: 0, reciters: 0});
  });

  it('puts playlists, loved surahs and favourite reciters in their tabs', () => {
    const shelf = buildShelf({
      playlists: [list('a', 'Morning', 5)],
      loved: [love(18, 'minshawi', 10)],
      favorites: [fav('sudais', 20)],
    });
    expect(keys(shelf.playlists)).toEqual(['p:a']);
    expect(keys(shelf.loved)).toEqual(['s:18:minshawi']);
    expect(keys(shelf.reciters)).toEqual(['r:sudais']);
    expect(isShelfEmpty(shelf)).toBe(false);
    expect(shelfCounts(shelf)).toEqual({playlists: 1, loved: 1, reciters: 1});
  });

  it('keeps the same surah in two voices as two tiles', () => {
    const shelf = buildShelf({
      ...none,
      loved: [love(18, 'a', 1), love(18, 'b', 2)],
    });
    expect(keys(shelf.loved)).toEqual(['s:18:b', 's:18:a']);
  });

  it('keeps the loved rewayah', () => {
    const [tile] = buildShelf({...none, loved: [love(2, 'a', 1)]}).loved;
    expect(tile).toMatchObject({kind: 'surah', rewayahId: 'a-warsh'});
  });

  it('dedupes favourites, keeping the newest date', () => {
    const shelf = buildShelf({
      ...none,
      favorites: [fav('x', 1), fav('x', 9)],
    });
    expect(shelf.reciters).toHaveLength(1);
    expect(shelf.reciters[0].at).toBe(9);
  });

  it('counts each favourite reciter’s loved surahs', () => {
    const shelf = buildShelf({
      ...none,
      loved: [love(1, 'x', 1), love(2, 'x', 2), love(3, 'y', 3)],
      favorites: [fav('x', 5), fav('z', 6)],
    });
    const count = (id: string) =>
      (shelf.reciters as ShelfReciter[]).find(r => r.reciterId === id)
        ?.surahCount;
    expect(count('x')).toBe(2);
    expect(count('z')).toBe(0);
  });

  it('leaves out reciters the app does not know', () => {
    const shelf = buildShelf({
      ...none,
      loved: [love(1, 'gone', 1), love(2, 'here', 2)],
      favorites: [fav('gone', 3)],
      isKnownReciter: id => id !== 'gone',
    });
    expect(keys(shelf.loved)).toEqual(['s:2:here']);
    expect(shelf.reciters).toEqual([]);
  });

  it('orders playlists by when they last changed', () => {
    const shelf = buildShelf({
      ...none,
      playlists: [list('old', 'B', 1), list('new', 'A', 2)],
    });
    expect(keys(shelf.playlists)).toEqual(['p:new', 'p:old']);
  });
});

describe('tabItems', () => {
  const shelf = buildShelf({
    playlists: [list('a', 'Zuhr', 2), list('b', 'asr', 1)],
    loved: [love(1, 'x', 1)],
    favorites: [],
  });
  const nameOf = (item: ShelfItem) =>
    item.kind === 'playlist' ? item.name : item.key;

  it('starts the Playlists tab with the New playlist tile', () => {
    expect(keys(tabItems(shelf, 'playlists', 'recent'))).toEqual([
      'new',
      'p:a',
      'p:b',
    ]);
  });

  it('keeps New first when sorted A to Z', () => {
    expect(keys(tabItems(shelf, 'playlists', 'az', nameOf))).toEqual([
      'new',
      'p:b',
      'p:a',
    ]);
  });

  it('shows the New tile even with no playlists', () => {
    expect(keys(tabItems(buildShelf(none), 'playlists', 'recent'))).toEqual([
      'new',
    ]);
  });

  it('has no New tile on the other tabs', () => {
    expect(keys(tabItems(shelf, 'loved', 'recent'))).toEqual(['s:1:x']);
    expect(tabItems(shelf, 'reciters', 'recent')).toEqual([]);
  });
});

describe('sortShelf', () => {
  const shelf = buildShelf({
    ...none,
    favorites: [fav('b', 1), fav('a', 2), fav('c', 2)],
  }).reciters;

  it('sorts A to Z by name, ignoring case', () => {
    const names: Record<string, string> = {
      'r:a': 'zed',
      'r:b': 'Alpha',
      'r:c': 'beta',
    };
    expect(keys(sortShelf(shelf, 'az', i => names[i.key]))).toEqual([
      'r:b',
      'r:c',
      'r:a',
    ]);
  });

  it('breaks name ties by recency', () => {
    expect(keys(sortShelf(shelf, 'az', () => 'same'))).toEqual([
      'r:a',
      'r:c',
      'r:b',
    ]);
  });

  it('returns to newest first', () => {
    expect(keys(sortShelf(shelf, 'recent'))).toEqual(['r:a', 'r:c', 'r:b']);
  });
});

describe('labels', () => {
  it('names the count of loved surahs', () => {
    expect(reciterTileLabel(0)).toBe('Reciter');
    expect(reciterTileLabel(1)).toBe('1 loved surah');
    expect(reciterTileLabel(3)).toBe('3 loved surahs');
  });

  it('names the voice, and the rewayah when it is not Hafs', () => {
    expect(surahTileCaption('Al-Minshawi', "Hafs A'n Assem")).toBe(
      'Al-Minshawi',
    );
    expect(surahTileCaption('Abdulbasit', 'Warsh A’n Nafi’')).toBe(
      'Abdulbasit · Warsh',
    );
    expect(surahTileCaption('', null)).toBe('');
  });

  it('counts surahs', () => {
    expect(surahCountLabel(0)).toBe('Empty');
    expect(surahCountLabel(1)).toBe('1 surah');
    expect(surahCountLabel(12)).toBe('12 surahs');
  });

  it('names a playlist’s voice or how many it mixes', () => {
    const voice = (id: string) => ({a: 'Al-Minshawi', b: 'Sudais'})[id] ?? '';
    expect(playlistCaption([], voice)).toBe('Empty');
    expect(playlistCaption([{reciterId: 'a'}, {reciterId: 'a'}], voice)).toBe(
      '2 surahs · Al-Minshawi',
    );
    expect(playlistCaption([{reciterId: 'a'}, {reciterId: 'b'}], voice)).toBe(
      '2 surahs · 2 reciters',
    );
    expect(playlistCaption([{reciterId: 'gone'}], voice)).toBe('1 surah');
  });
});
