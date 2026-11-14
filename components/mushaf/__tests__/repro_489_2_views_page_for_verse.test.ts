/**
 * Repro for finding 2 of the PR 489 review (RFC-023 step 2).
 *
 * ContinuousListView.tsx and ContinuousMushafView.tsx each keep a private
 * getPageForVerse that, after any getCacheVersion() change, rebuilds a verse
 * to page map by calling mushafVerseMapService.getOrderedVerseKeysForPage for
 * all 604 pages. Since step 2 that reads words: getOrderedVerseKeysForPage
 * goes through getVerseSegments and getLineWordSpans, which read word texts,
 * so the rebuild does about 40 synchronous chunk reads on the JS thread and
 * pushes the reader's own chunks out of the 24 chunk cache. The cache version
 * also bumps on a player side load, so that alone triggers a rebuild on the
 * next scroll. digitalKhattDataService.getPageForVerse already gives the same
 * page for every verse and reads no word.
 *
 * The views' function is module-private, so its body is copied below,
 * verbatim from both views at the PR head (they are identical apart from a
 * comment). Once both views call digitalKhattDataService.getPageForVerse, the
 * copy and the first two tests go away with them.
 *
 * What the tests expect: building the views' verse to page lookup reads no
 * word chunk, and a reader's cached chunk (page 50) is not read again
 * afterwards.
 *
 * What happens on the PR head: the lookup does 40 chunk reads, and the page 50
 * chunk is evicted and read again once. The third test passes on the head: it
 * shows that digitalKhattDataService.getPageForVerse gives the same page as
 * the views' map for all 6,236 verses on all 8 bundled words DBs, with no
 * chunk read, so it is a drop in replacement.
 *
 * LOCAL-ONLY like the *.alldbs suites (skipped unless BAYAAN_OVERLAY_DB_DIR is
 * set; needs node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest components/mushaf/__tests__/repro_489_2_views_page_for_verse -w 1
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// The bundled DBs through node:sqlite, with every chunk read (the WordStore's
// group_concat query through getFirstSync) recorded as "<base>:<first id>".
jest.mock('expo-sqlite', () => {
  const sqlite = jest
    .requireActual('@/services/mushaf/__fixtures__/bundledDkSqlite')
    .bundledDkSqliteModule();
  const chunkReads: string[] = [];
  const open = sqlite.openDatabaseAsync;
  return {
    ...sqlite,
    __chunkReads: chunkReads,
    async openDatabaseAsync(name: string) {
      const db = await open(name);
      const base = name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
      const getFirstSync = db.getFirstSync;
      return {
        ...db,
        getFirstSync(sql: string, params: unknown[] = []) {
          if (sql.includes('group_concat')) {
            chunkReads.push(`${base}:${String(params[0])}`);
          }
          return getFirstSync(sql, params);
        },
      };
    },
  };
});
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: async () => [],
  getInfoAsync: async () => ({exists: false}),
}));

import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {hasNodeSqlite} from '@/services/mushaf/__fixtures__/bundledDkSqlite';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const chunkReads = (jest.requireMock('expo-sqlite') as {__chunkReads: string[]})
  .__chunkReads;

const REWAYAT: RewayahId[] = [
  'hafs',
  'shubah',
  'al-bazzi',
  'qunbul',
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
];

/**
 * The verse to page map of getPageForVerse in ContinuousListView.tsx
 * (lines 142 to 163) and ContinuousMushafView.tsx (lines 143 to 162) at the
 * PR head, without the module-level cache around it.
 */
function viewsVerseToPage(): Map<string, number> {
  const verseToPageMap = new Map<string, number>();
  for (let page = 1; page <= 604; page++) {
    const keys = mushafVerseMapService.getOrderedVerseKeysForPage(page);
    for (const key of keys) {
      // First occurrence wins: a verse spanning two pages maps to its start page
      if (!verseToPageMap.has(key)) {
        verseToPageMap.set(key, page);
      }
    }
  }
  return verseToPageMap;
}

const run =
  process.env.BAYAAN_OVERLAY_DB_DIR && hasNodeSqlite()
    ? describe
    : describe.skip;

run('finding 2: the views build their verse to page map from the words', () => {
  let spies: jest.SpyInstance[] = [];
  beforeAll(async () => {
    spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    ];
    useMushafSettingsStore.setState({rewayah: 'hafs'});
    await digitalKhattDataService.initialize();
  }, 120_000);
  afterAll(() => {
    for (const spy of spies) spy.mockRestore();
    useMushafSettingsStore.setState({rewayah: 'hafs'});
  });

  /** A reader on `page`: reads the first word of its first ayah line. */
  function readPage(page: number): string {
    const line = digitalKhattDataService
      .getPageLines(page)
      .find(row => row.line_type === 'ayah')!;
    digitalKhattDataService.getWordText(line.first_word_id);
    return `dk_words:${Math.floor((line.first_word_id - 1) / 2048) * 2048 + 1}`;
  }

  it("building the views' verse to page lookup reads no word chunk", () => {
    expect(digitalKhattDataService.rewayah).toBe('hafs');
    mushafVerseMapService.clear();
    readPage(50);
    chunkReads.length = 0;
    const map = viewsVerseToPage();
    expect(map.size).toBe(6236);
    expect(chunkReads.length).toBe(0);
  }, 120_000);

  it("a reader's cached chunk survives the views' lookup", () => {
    mushafVerseMapService.clear();
    const readerChunk = readPage(50);
    viewsVerseToPage();
    chunkReads.length = 0;
    readPage(50); // the reader draws page 50 again
    expect(chunkReads.filter(read => read === readerChunk).length).toBe(0);
  }, 120_000);

  it.each(REWAYAT)(
    '%s: digitalKhattDataService.getPageForVerse gives the same pages with no chunk read (passes on the head)',
    async rewayah => {
      if (digitalKhattDataService.rewayah !== rewayah) {
        await digitalKhattDataService.switchRewayah(rewayah);
      }
      const views = viewsVerseToPage();
      chunkReads.length = 0;
      const differences: string[] = [];
      for (const [verseKey, page] of views) {
        const servicePage = digitalKhattDataService.getPageForVerse(verseKey);
        if (servicePage !== page) {
          differences.push(`${verseKey}: ${page} vs ${servicePage}`);
        }
      }
      expect({
        verses: views.size,
        differences,
        serviceReads: chunkReads.length,
      }).toEqual({verses: 6236, differences: [], serviceReads: 0});
    },
    120_000,
  );
});
