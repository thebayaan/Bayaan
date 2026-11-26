// @ai-generated
// The verse data every reading surface shares is rebuilt when the selected
// translation is applied. The rebuild is now asked for by the app (startup,
// every change of the setting) as well as by the player, so:
//  - every rebuild is counted, for the screens that hold verse objects;
//  - the latest request wins, whatever order the database reads finish in;
//  - the Mushaf list view's page cache is dropped with the old arrays (it
//    kept the previous translation's text on every page already visited).

const mockGetAllVerses = jest.fn();
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {
    getAllVerses: (...args: unknown[]) => mockGetAllVerses(...args),
  },
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {getPageLines: () => []},
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: (page: number) =>
      page === 1 ? ['1:1', '1:2'] : [],
  },
}));

interface Isolated {
  rebuildEnhancedVerses: typeof import('../enhancedVerseData').rebuildEnhancedVerses;
  enhancedVersesBySurah: typeof import('../enhancedVerseData').enhancedVersesBySurah;
  getEnhancedVersesVersion: typeof import('../enhancedVersesVersion').getEnhancedVersesVersion;
  getReadingPageItems: typeof import('../mushafPageVerses').getReadingPageItems;
  getTranslationTextRaw: typeof import('../translationLookup').getTranslationTextRaw;
}

function loadIsolated(): Isolated {
  let loaded: Isolated | undefined;
  jest.isolateModules(() => {
    loaded = {
      rebuildEnhancedVerses: require('../enhancedVerseData')
        .rebuildEnhancedVerses,
      enhancedVersesBySurah: require('../enhancedVerseData')
        .enhancedVersesBySurah,
      getEnhancedVersesVersion: require('../enhancedVersesVersion')
        .getEnhancedVersesVersion,
      getReadingPageItems: require('../mushafPageVerses').getReadingPageItems,
      getTranslationTextRaw: require('../translationLookup')
        .getTranslationTextRaw,
    };
  });
  if (!loaded) throw new Error('modules not loaded');
  return loaded;
}

/** A database read that finishes when the test says so. */
function deferredRead(): {
  promise: Promise<Record<string, string>>;
  resolve: (map: Record<string, string>) => void;
} {
  let resolve: (map: Record<string, string>) => void = () => undefined;
  const promise = new Promise<Record<string, string>>(r => {
    resolve = r;
  });
  return {promise, resolve};
}

const firstVerse = (m: Isolated): string | undefined =>
  m.enhancedVersesBySurah[1][0].translation;

beforeEach(() => {
  mockGetAllVerses.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('rebuildEnhancedVerses', () => {
  it('counts a rebuild, and nothing when the translation is already applied', async () => {
    const m = loadIsolated();
    const before = m.getEnhancedVersesVersion();
    expect(await m.rebuildEnhancedVerses('saheeh')).toBe(false);
    expect(m.getEnhancedVersesVersion()).toBe(before);

    expect(await m.rebuildEnhancedVerses('clear-quran')).toBe(true);
    expect(m.getEnhancedVersesVersion()).toBe(before + 1);
    expect(firstVerse(m)).toBe(
      'In the Name of Allah—the Most Compassionate, Most Merciful.',
    );

    expect(await m.rebuildEnhancedVerses('clear-quran')).toBe(false);
    expect(m.getEnhancedVersesVersion()).toBe(before + 1);
  });

  it('counts a downloaded translation once it has been read', async () => {
    const m = loadIsolated();
    const before = m.getEnhancedVersesVersion();
    const read = deferredRead();
    mockGetAllVerses.mockReturnValue(read.promise);
    const pending = m.rebuildEnhancedVerses('ur.jalandhry');
    expect(m.getEnhancedVersesVersion()).toBe(before);
    read.resolve({'1:1': 'urdu 1:1'});
    expect(await pending).toBe(true);
    expect(m.getEnhancedVersesVersion()).toBe(before + 1);
    expect(firstVerse(m)).toBe('urdu 1:1');
    expect(m.getTranslationTextRaw('1:1', 'ur.jalandhry')).toBe('urdu 1:1');
  });

  it('a slow read that finishes late does not put an older choice back', async () => {
    const m = loadIsolated();
    const read = deferredRead();
    mockGetAllVerses.mockReturnValue(read.promise);
    // The reader picks a downloaded translation, then Clear Quran before
    // the first one has been read.
    const slow = m.rebuildEnhancedVerses('ur.jalandhry');
    expect(await m.rebuildEnhancedVerses('clear-quran')).toBe(true);
    const version = m.getEnhancedVersesVersion();

    read.resolve({'1:1': 'urdu 1:1'});
    expect(await slow).toBe(false);
    expect(firstVerse(m)).toBe(
      'In the Name of Allah—the Most Compassionate, Most Merciful.',
    );
    expect(m.getEnhancedVersesVersion()).toBe(version);
    expect(m.getTranslationTextRaw('1:1', 'ur.jalandhry')).toBe('');
  });

  it('going back to the applied translation cancels a read in progress', async () => {
    const m = loadIsolated();
    const saheeh = firstVerse(m);
    const read = deferredRead();
    mockGetAllVerses.mockReturnValue(read.promise);
    const slow = m.rebuildEnhancedVerses('ur.jalandhry');
    expect(await m.rebuildEnhancedVerses('saheeh')).toBe(false);
    read.resolve({'1:1': 'urdu 1:1'});
    expect(await slow).toBe(false);
    expect(firstVerse(m)).toBe(saheeh);
  });

  it('two requests for the translation being read share one read', async () => {
    const m = loadIsolated();
    const read = deferredRead();
    mockGetAllVerses.mockReturnValue(read.promise);
    const first = m.rebuildEnhancedVerses('ur.jalandhry');
    const second = m.rebuildEnhancedVerses('ur.jalandhry');
    read.resolve({'1:1': 'urdu 1:1'});
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(mockGetAllVerses).toHaveBeenCalledTimes(1);
    expect(firstVerse(m)).toBe('urdu 1:1');
  });

  it('picking a translation again after choosing another reads it afresh', async () => {
    const m = loadIsolated();
    const firstRead = deferredRead();
    const secondRead = deferredRead();
    mockGetAllVerses
      .mockReturnValueOnce(firstRead.promise)
      .mockReturnValueOnce(secondRead.promise);
    const first = m.rebuildEnhancedVerses('ur.jalandhry');
    await m.rebuildEnhancedVerses('clear-quran');
    // The first read is still running and has been superseded: joining it
    // would leave Clear Quran on screen under the Urdu translation's name.
    const second = m.rebuildEnhancedVerses('ur.jalandhry');
    firstRead.resolve({'1:1': 'urdu 1:1'});
    secondRead.resolve({'1:1': 'urdu 1:1'});
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(firstVerse(m)).toBe('urdu 1:1');
  });
});

describe('getReadingPageItems', () => {
  it('gives a page its verses in the translation applied since it was last read', async () => {
    const m = loadIsolated();
    const translationOf = (): (string | undefined)[] =>
      m
        .getReadingPageItems(1)
        .map(item => (item.type === 'verse' ? item.verse.translation : null))
        .filter((text): text is string => text !== null);

    const saheeh = translationOf();
    expect(saheeh[0]).toContain('In the name of Allāh,');
    // Unchanged data: the same cached items.
    expect(m.getReadingPageItems(1)).toBe(m.getReadingPageItems(1));

    await m.rebuildEnhancedVerses('clear-quran');
    expect(translationOf()).toEqual([
      'In the Name of Allah—the Most Compassionate, Most Merciful.',
      'All praise is for Allah—Lord of all worlds,',
    ]);
  });
});
