// @ai RFC-023 step 2: the words on demand.
/**
 * LOCAL-ONLY (skipped unless BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.13
 * for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest DigitalKhattDataService.perPage.alldbs --watchAll=false
 *
 * The real DigitalKhattDataService loads each of the 8 bundled words DBs as a
 * WordStore: a verse index at load, the words in chunks when a getter needs
 * them. Every getter must give exactly what the old full build gave: all
 * 83,668 words read in one statement, grouped by verse, the surah start
 * pages from the first word of each ayah line, and the page of every verse
 * from its words. The reference below is that old build, run here directly
 * on the DB files (not through the data service).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-sqlite', () =>
  jest
    .requireActual('@/services/mushaf/__fixtures__/bundledDkSqlite')
    .bundledDkSqliteModule(),
);
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: async () => [],
  getInfoAsync: async () => ({exists: false}),
}));

import {
  DigitalKhattDataService,
  type DKLine,
  type DKWordInfo,
} from '../DigitalKhattDataService';
import {
  bundledDkFile,
  hasNodeSqlite,
  type BundledDkSqliteFake,
} from '../__fixtures__/bundledDkSqlite';
import {joinSlotTexts, layoutLineSlots, visibleWords} from '../lineWordSpans';
import {WORD_CHUNK_QUERY} from '../wordStore';
import {
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';

interface SqliteDb {
  prepare(sql: string): {all(...params: unknown[]): Record<string, unknown>[]};
  close(): void;
}

/** Every rewayah with a bundled words DB, and the base of that DB. */
const REWAYAT: [RewayahId, string][] = [
  ['hafs', 'dk_words'],
  ['shubah', 'dk_words_shouba'],
  ['al-bazzi', 'dk_words_bazzi'],
  ['qunbul', 'dk_words_qumbul'],
  ['warsh', 'dk_words_warsh'],
  ['qalun', 'dk_words_qaloon'],
  ['al-duri-abi-amr', 'dk_words_doori'],
  ['al-susi', 'dk_words_soosi'],
];

function readAll(
  base: string,
  sql: string,
  params: unknown[] = [],
): Record<string, unknown>[] {
  const {DatabaseSync} = require('node:sqlite') as {
    DatabaseSync: new (file: string, options?: object) => SqliteDb;
  };
  const db = new DatabaseSync(bundledDkFile(base), {readOnly: true});
  try {
    return db.prepare(sql).all(...params);
  } finally {
    db.close();
  }
}

interface Reference {
  texts: Map<number, string>;
  infos: Map<number, DKWordInfo>;
  verseWords: Map<string, DKWordInfo[]>;
  surahStartPages: Record<number, number>;
  pageToSurah: Record<number, number>;
  verseToPage: Map<string, number>;
  ayahLines: DKLine[];
}

/** The old full build (before the WordStore), on the DB files. */
function oldFullBuild(base: string, lines: DKLine[]): Reference {
  const texts = new Map<number, string>();
  const infos = new Map<number, DKWordInfo>();
  for (const row of readAll(base, 'SELECT id, text, location FROM words')) {
    const id = Number(row.id);
    const text = row.text as string;
    texts.set(id, text);
    const parts = (row.location as string).split(':');
    if (parts.length >= 3) {
      infos.set(id, {
        text,
        verseKey: `${parts[0]}:${parts[1]}`,
        wordPositionInVerse: parseInt(parts[2], 10),
      });
    }
  }
  const verseWords = new Map<string, DKWordInfo[]>();
  for (const info of infos.values()) {
    const list = verseWords.get(info.verseKey);
    if (list) list.push(info);
    else verseWords.set(info.verseKey, [info]);
  }
  for (const list of verseWords.values()) {
    list.sort((a, b) => a.wordPositionInVerse - b.wordPositionInVerse);
  }
  const surahStartPages: Record<number, number> = {};
  for (const row of lines) {
    if (row.line_type !== 'ayah') continue;
    const info = infos.get(row.first_word_id);
    if (!info) continue;
    const surahId = parseInt(info.verseKey.split(':')[0], 10);
    if (surahId && !surahStartPages[surahId]) {
      surahStartPages[surahId] = row.page_number;
    }
  }
  for (const row of lines) {
    if (row.line_type !== 'surah_name') continue;
    if (row.surah_number && !surahStartPages[row.surah_number]) {
      surahStartPages[row.surah_number] = row.page_number;
    }
  }
  const pageToSurah: Record<number, number> = {};
  const surahIds = Object.keys(surahStartPages)
    .map(Number)
    .sort((a, b) => surahStartPages[a] - surahStartPages[b]);
  for (let i = 0; i < surahIds.length; i++) {
    const end =
      i < surahIds.length - 1 ? surahStartPages[surahIds[i + 1]] - 1 : 604;
    for (let page = surahStartPages[surahIds[i]]; page <= end; page++) {
      if (!pageToSurah[page]) pageToSurah[page] = surahIds[i];
    }
  }
  const verseToPage = new Map<string, number>();
  for (const row of lines) {
    if (row.line_type !== 'ayah') continue;
    for (let id = row.first_word_id; id <= row.last_word_id; id++) {
      const info = infos.get(id);
      if (info && !verseToPage.has(info.verseKey)) {
        verseToPage.set(info.verseKey, row.page_number);
      }
    }
  }
  return {
    texts,
    infos,
    verseWords,
    surahStartPages,
    pageToSurah,
    verseToPage,
    ayahLines: lines.filter(row => row.line_type === 'ayah'),
  };
}

const fake = (): BundledDkSqliteFake =>
  (jest.requireMock('expo-sqlite') as {__fake: BundledDkSqliteFake}).__fake;

const run =
  process.env.BAYAAN_OVERLAY_DB_DIR && hasNodeSqlite()
    ? describe
    : describe.skip;

run('the words read on demand (local only)', () => {
  let spies: jest.SpyInstance[] = [];
  let lines: DKLine[] = [];
  beforeAll(() => {
    spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    ];
    lines = readAll(
      'dk_layout',
      'SELECT * FROM pages ORDER BY page_number, line_number',
    ) as unknown as DKLine[];
  });
  afterAll(() => {
    for (const spy of spies) spy.mockRestore();
    useMushafSettingsStore.setState({rewayah: 'hafs'});
  });

  // A chunk read must seek, not scan the table: words.id is the INTEGER
  // PRIMARY KEY of every words DB (a page turn can need a chunk). The plan of
  // the query the app runs also has a temp B-tree, for the ORDER BY of its
  // group_concat.
  it.each(REWAYAT)('%s: a chunk read seeks by id', (_rewayah, base) => {
    const plan = readAll(
      base,
      `EXPLAIN QUERY PLAN ${WORD_CHUNK_QUERY}`,
      [1, 2048],
    ).map(row => String(row.detail));
    expect(plan).toContainEqual(
      expect.stringContaining('SEARCH words USING INTEGER PRIMARY KEY'),
    );
    expect(plan).not.toContainEqual(expect.stringContaining('SCAN'));
  });

  it.each(REWAYAT)(
    '%s: every getter gives what the old full build gave',
    async (rewayah, base) => {
      const ref = oldFullBuild(base, lines);
      useMushafSettingsStore.setState({rewayah});
      const dk = new DigitalKhattDataService();
      const readsBefore = fake().reads.filter(b => b === base).length;
      await dk.initialize();
      expect(dk.rewayah).toBe(rewayah);
      // One asynchronous read of the words DB at load: the verse index.
      expect(fake().reads.filter(b => b === base).length - readsBefore).toBe(1);
      // The continuous views look a verse's page up here: it reads no word.
      const chunkReads = fake().chunkReads.length;
      for (const [verseKey, page] of ref.verseToPage) {
        expect(dk.getPageForVerse(verseKey)).toBe(page);
      }
      expect(fake().chunkReads.length).toBe(chunkReads);

      for (const [id, text] of ref.texts) {
        expect(dk.getWordText(id)).toBe(text);
        expect(dk.getWordInfo(id)).toEqual(ref.infos.get(id));
      }
      expect(dk.getWordText(ref.texts.size + 1)).toBe('');
      expect(dk.getWordInfo(0)).toBeUndefined();
      for (const [verseKey, slots] of ref.verseWords) {
        expect(dk.getVerseWords(verseKey)).toEqual(visibleWords(slots));
        expect(dk.getVerseText(verseKey)).toBe(
          joinSlotTexts(visibleWords(slots)),
        );
      }
      expect(dk.getVerseWords('115:1')).toEqual([]);
      expect(dk.getSurahStartPages()).toEqual(ref.surahStartPages);
      expect(dk.getPageToSurah()).toEqual(ref.pageToSurah);
      for (const line of ref.ayahLines) {
        expect(dk.getLineText(line)).toBe(
          layoutLineSlots(line.first_word_id, line.last_word_id, id =>
            ref.texts.get(id),
          ).text,
        );
      }
    },
    120_000,
  );

  // The verse-units build reads through this sweep, outside the chunk cache.
  it.each(REWAYAT)(
    '%s: the sweep gives every row of the table',
    async (rewayah, base) => {
      useMushafSettingsStore.setState({rewayah});
      const dk = new DigitalKhattDataService();
      await dk.initialize();
      const slots = Array.from(dk.readWordSlots(rewayah)!, slot => ({...slot}));
      expect(slots).toEqual(
        readAll(
          base,
          'SELECT id, surah, ayah, word, text FROM words ORDER BY id',
        ),
      );
      await dk.resetDatabases();
    },
  );

  it('reads a side rewayah on demand, next to the main one', async () => {
    const ref = oldFullBuild('dk_words_warsh', lines);
    useMushafSettingsStore.setState({rewayah: 'hafs'});
    const dk = new DigitalKhattDataService();
    await dk.initialize();
    await dk.ensureRewayahLoaded('warsh');
    expect(dk.isRewayahReady('warsh')).toBe(true);
    for (const [verseKey, slots] of ref.verseWords) {
      expect(dk.getVerseWords(verseKey, 'warsh')).toEqual(visibleWords(slots));
    }
  }, 120_000);
});
