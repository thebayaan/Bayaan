import {
  buildShelf,
  filterShelf,
  reciterTileLabel,
  shelfCounts,
  sortShelf,
  surahTileCaption,
  type ShelfItem,
  type ShelfSources,
} from './libraryShelf';

const none: ShelfSources = {
  continueEntries: [],
  loved: [],
  recent: [],
  favorites: [],
};

function cont(
  surahNumber: number,
  reciterId: string,
  updatedAt: number,
  positionSeconds = 120,
) {
  return {
    surahNumber,
    reciterId,
    rewayahId: `${reciterId}-hafs`,
    positionSeconds,
    durationSeconds: 600,
    updatedAt,
  };
}

function love(surahNumber: number, reciterId: string, addedAt: number) {
  return {surahNumber, reciterId, rewayahId: `${reciterId}-warsh`, addedAt};
}

const keys = (items: ShelfItem[]) => items.map(i => i.key);

describe('buildShelf', () => {
  it('is empty with nothing kept', () => {
    expect(buildShelf(none)).toEqual([]);
  });

  it('keeps one tile per surah and reciter, the unfinished entry winning', () => {
    const shelf = buildShelf({
      ...none,
      continueEntries: [cont(18, 'minshawi', 100)],
      loved: [love(18, 'minshawi', 50)],
    });
    expect(shelf).toHaveLength(1);
    const tile = shelf[0];
    expect(tile.kind).toBe('surah');
    if (tile.kind !== 'surah') return;
    expect(tile.loved).toBe(true);
    expect(tile.progress).toEqual({positionSeconds: 120, durationSeconds: 600});
    expect(tile.rewayahId).toBe('minshawi-hafs');
    expect(tile.at).toBe(100);
  });

  it('dates a merged tile by its newest activity', () => {
    const shelf = buildShelf({
      ...none,
      continueEntries: [cont(18, 'minshawi', 100), cont(2, 'afasy', 150)],
      loved: [love(18, 'minshawi', 200)],
    });
    expect(keys(shelf)).toEqual(['s:18:minshawi', 's:2:afasy']);
  });

  it('keeps the same surah in two voices as two tiles', () => {
    const shelf = buildShelf({
      ...none,
      continueEntries: [cont(36, 'abdulbasit', 300)],
      loved: [love(36, 'dosari', 200)],
    });
    expect(keys(shelf)).toEqual(['s:36:abdulbasit', 's:36:dosari']);
    const loved = shelf[1];
    expect(loved.kind === 'surah' && loved.progress).toBe(null);
  });

  it('uses the newest of duplicated unfinished entries', () => {
    const shelf = buildShelf({
      ...none,
      continueEntries: [cont(1, 'a', 10, 30), cont(1, 'a', 90, 300)],
    });
    expect(shelf).toHaveLength(1);
    expect(
      shelf[0].kind === 'surah' && shelf[0].progress?.positionSeconds,
    ).toBe(300);
  });

  it('dedupes reciters from recently played and favorites', () => {
    const shelf = buildShelf({
      ...none,
      recent: [
        {reciterId: 'afasy', visitedAt: 400},
        {reciterId: 'ghamdi', visitedAt: 100},
      ],
      favorites: [
        {reciterId: 'ghamdi', addedAt: 500},
        {reciterId: 'afasy', addedAt: 50},
      ],
    });
    expect(keys(shelf)).toEqual(['r:ghamdi', 'r:afasy']);
    expect(shelf.every(i => i.kind === 'reciter' && i.favorite)).toBe(true);
  });

  it('counts each reciter’s surah tiles', () => {
    const shelf = buildShelf({
      ...none,
      continueEntries: [cont(18, 'afasy', 10), cont(2, 'afasy', 20)],
      loved: [love(67, 'afasy', 30), love(18, 'afasy', 5)],
      recent: [
        {reciterId: 'afasy', visitedAt: 1},
        {reciterId: 'ghamdi', visitedAt: 2},
      ],
    });
    const counts = Object.fromEntries(
      shelf.flatMap(i =>
        i.kind === 'reciter' ? [[i.reciterId, i.surahCount]] : [],
      ),
    );
    expect(counts).toEqual({afasy: 3, ghamdi: 0});
  });

  it('interleaves surahs and reciters newest first', () => {
    const shelf = buildShelf({
      ...none,
      continueEntries: [cont(18, 'minshawi', 300)],
      loved: [love(67, 'afasy', 100)],
      recent: [{reciterId: 'afasy', visitedAt: 200}],
    });
    expect(keys(shelf)).toEqual(['s:18:minshawi', 'r:afasy', 's:67:afasy']);
  });

  it('leaves out reciters the app does not know', () => {
    const shelf = buildShelf({
      continueEntries: [cont(18, 'gone', 300)],
      loved: [love(1, 'gone', 1)],
      recent: [{reciterId: 'gone', visitedAt: 2}],
      favorites: [{reciterId: 'here', addedAt: 3}],
      isKnownReciter: id => id === 'here',
    });
    expect(keys(shelf)).toEqual(['r:here']);
  });
});

describe('sortShelf', () => {
  const shelf = buildShelf({
    ...none,
    continueEntries: [cont(18, 'minshawi', 300)],
    loved: [love(1, 'afasy', 100)],
    recent: [{reciterId: 'afasy', visitedAt: 200}],
  });
  const names: Record<string, string> = {
    's:18:minshawi': 'Al-Kahf',
    's:1:afasy': 'Al-Fatihah',
    'r:afasy': 'mishary Alafasi',
  };

  it('sorts A to Z by name, ignoring case', () => {
    expect(keys(sortShelf(shelf, 'az', i => names[i.key]))).toEqual([
      's:1:afasy',
      's:18:minshawi',
      'r:afasy',
    ]);
  });

  it('breaks name ties by recency', () => {
    expect(keys(sortShelf(shelf, 'az', () => 'same'))).toEqual(keys(shelf));
  });

  it('returns to newest first', () => {
    const az = sortShelf(shelf, 'az', i => names[i.key]);
    expect(keys(sortShelf(az, 'recent'))).toEqual(keys(shelf));
  });
});

describe('filterShelf and shelfCounts', () => {
  const shelf = buildShelf({
    ...none,
    continueEntries: [cont(18, 'minshawi', 300)],
    loved: [love(1, 'afasy', 100)],
    recent: [{reciterId: 'afasy', visitedAt: 200}],
  });

  it('filters by kind', () => {
    expect(filterShelf(shelf, 'all')).toHaveLength(3);
    expect(filterShelf(shelf, 'surahs').map(i => i.kind)).toEqual([
      'surah',
      'surah',
    ]);
    expect(keys(filterShelf(shelf, 'reciters'))).toEqual(['r:afasy']);
  });

  it('counts each tab', () => {
    expect(shelfCounts(shelf)).toEqual({all: 3, surahs: 2, reciters: 1});
    expect(shelfCounts([])).toEqual({all: 0, surahs: 0, reciters: 0});
  });
});

describe('reciterTileLabel', () => {
  it('names the count of surahs', () => {
    expect(reciterTileLabel(0)).toBe('Reciter');
    expect(reciterTileLabel(1)).toBe('Reciter · 1 surah');
    expect(reciterTileLabel(3)).toBe('Reciter · 3 surahs');
  });
});

describe('surahTileCaption', () => {
  const progress = {positionSeconds: 0, durationSeconds: 1080};

  it('names the voice and the time left', () => {
    expect(surahTileCaption({progress}, 'Al-Minshawi', "Hafs A'n Assem")).toBe(
      'Al-Minshawi · 18 min left',
    );
  });

  it('adds the rewayah when it is not Hafs', () => {
    expect(surahTileCaption({progress}, 'Abdulbasit', "Warsh A'n Nafi'")).toBe(
      'Abdulbasit · Warsh · 18 min left',
    );
  });

  it('is just the voice for a loved surah', () => {
    expect(surahTileCaption({progress: null}, 'Alafasi')).toBe('Alafasi');
    expect(surahTileCaption({progress: null}, '')).toBe('');
  });
});
