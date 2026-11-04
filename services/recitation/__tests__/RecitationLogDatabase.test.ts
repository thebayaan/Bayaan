// The recitation log on a real SQLite file (better-sqlite3 behind the
// expo-sqlite mock).
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {closeOpenDatabases, resetDatabases} from '@/test-utils/mockExpoSqlite';
import {RecitationLogDatabase} from '../RecitationLogDatabase';
import type {TakeRecord, TakeWord} from '../take';

function take(overrides: Partial<TakeRecord>): TakeRecord {
  return {
    id: 'take',
    purpose: 'follow',
    startedAt: 1000,
    endedAt: 2000,
    hidden: true,
    expected: null,
    stopReason: 'user',
    ayat: [{surah: 67, ayah: 1, confidence: 0.9}],
    flags: [],
    peeks: [],
    stalls: [],
    ...overrides,
  };
}

const TAKE_A = take({
  id: 'a',
  startedAt: 1000,
  endedAt: 2000,
  ayat: [
    {surah: 67, ayah: 1, confidence: 0.9},
    {surah: 67, ayah: 2, confidence: 0.8},
  ],
  peeks: [{surah: 67, ayah: 2, kind: 'word', at: 1500}],
});

const TAKE_B = take({
  id: 'b',
  startedAt: 5000,
  endedAt: 9000,
  hidden: false,
  ayat: [
    {surah: 67, ayah: 2, confidence: 0.95},
    {surah: 67, ayah: 3, confidence: 0.9},
    {surah: 67, ayah: 5, confidence: 0.9},
  ],
  flags: [
    {
      kind: 'possible_skipped_ayah',
      surah: 67,
      ayah: 4,
      word: 1,
      source: 'ayah_order',
    },
  ],
  stalls: [{surah: 67, ayah: 2, wordIndex: 3, ms: 3200, at: 6000}],
});

let db: RecitationLogDatabase;

beforeEach(async () => {
  await resetDatabases();
  db = new RecitationLogDatabase();
});

describe('RecitationLogDatabase', () => {
  it('records takes and lists them newest first with their counts', async () => {
    await db.recordTake(TAKE_A);
    await db.recordTake(TAKE_B);
    expect(await db.recentTakes(10)).toEqual([
      {
        id: 'b',
        purpose: 'follow',
        startedAt: 5000,
        endedAt: 9000,
        hidden: false,
        ayatCount: 3,
        flagCount: 1,
        peekCount: 0,
        stallCount: 1,
      },
      {
        id: 'a',
        purpose: 'follow',
        startedAt: 1000,
        endedAt: 2000,
        hidden: true,
        ayatCount: 2,
        flagCount: 0,
        peekCount: 1,
        stallCount: 0,
      },
    ]);
  });

  it('ayahHistory has one row per take that touched the ayah', async () => {
    await db.recordTake(TAKE_A);
    await db.recordTake(TAKE_B);
    expect(await db.ayahHistory(67, 2)).toEqual([
      {
        takeId: 'b',
        recitedAt: 5000,
        recited: true,
        hidden: false,
        flags: 0,
        peeks: 0,
        stalls: 1,
      },
      {
        takeId: 'a',
        recitedAt: 1000,
        recited: true,
        hidden: true,
        flags: 0,
        peeks: 1,
        stalls: 0,
      },
    ]);
    expect(await db.ayahHistory(67, 9)).toEqual([]);
  });

  it('an ayah flagged as skipped gets a row with recited false', async () => {
    await db.recordTake(TAKE_B);
    expect(await db.ayahHistory(67, 4)).toEqual([
      {
        takeId: 'b',
        recitedAt: 5000,
        recited: false,
        hidden: false,
        flags: 1,
        peeks: 0,
        stalls: 0,
      },
    ]);
  });

  it('getTake returns the whole record', async () => {
    await db.recordTake(TAKE_B);
    expect(await db.getTake('b')).toEqual(TAKE_B);
    expect(await db.getTake('missing')).toBeNull();
  });

  it('a take with no ayat and no flags is not saved', async () => {
    await db.recordTake(take({id: 'empty', ayat: [], flags: []}));
    expect(await db.recentTakes(10)).toEqual([]);
  });

  it('clearHistory removes everything', async () => {
    await db.recordTake(TAKE_A);
    await db.clearHistory();
    expect(await db.recentTakes(10)).toEqual([]);
    expect(await db.ayahHistory(67, 1)).toEqual([]);
  });

  it('takes survive reopening the database', async () => {
    await db.recordTake(TAKE_A);
    await closeOpenDatabases();
    const reopened = new RecitationLogDatabase();
    expect(await reopened.recentTakes(10)).toHaveLength(1);
    expect(await reopened.getTake('a')).toEqual(TAKE_A);
  });

  it('a dismissed flag is remembered across reopening', async () => {
    await db.dismiss({
      kind: 'skippedWord',
      surah: 18,
      ayah: 22,
      word: 4,
      key: 'skippedWord:18:22:4',
    });
    await db.dismiss({
      kind: 'skippedWord',
      surah: 18,
      ayah: 22,
      word: 4,
      key: 'skippedWord:18:22:4',
    });
    await closeOpenDatabases();
    const reopened = new RecitationLogDatabase();
    expect(await reopened.dismissedKeys()).toEqual(
      new Set(['skippedWord:18:22:4']),
    );
  });

  it('clearHistory also forgets dismissals', async () => {
    await db.dismiss({
      kind: 'skippedAyah',
      surah: 2,
      ayah: 7,
      word: 0,
      key: 'skippedAyah:2:7:0',
    });
    await db.clearHistory();
    expect(await db.dismissedKeys()).toEqual(new Set());
  });

  describe('word results', () => {
    function word(
      w: number,
      result: TakeWord['result'],
      at: number,
      extra: Partial<TakeWord> = {},
    ): TakeWord {
      const kind =
        result === 'mistake' || result === 'corrected' ? 'wrong' : null;
      return {
        surah: 67,
        ayah: 1,
        word: w,
        result,
        kind,
        hidden: false,
        at,
        ...extra,
      };
    }

    it('every judged word of a take is saved, and mistakes are listed newest first', async () => {
      await db.recordTake(
        take({
          id: 'a',
          words: [
            word(1, 'correct', 1100),
            word(2, 'mistake', 1200, {kind: 'missed'}),
            word(3, 'unclear', 1300),
          ],
        }),
      );
      await db.recordTake(
        take({
          id: 'b',
          startedAt: 5000,
          words: [word(4, 'mistake', 5100, {ayah: 2, hidden: true})],
        }),
      );
      expect(await db.mistakes()).toEqual([
        {
          takeId: 'b',
          surah: 67,
          ayah: 2,
          word: 4,
          result: 'mistake',
          kind: 'wrong',
          hidden: true,
          at: 5100,
        },
        {
          takeId: 'a',
          surah: 67,
          ayah: 1,
          word: 2,
          result: 'mistake',
          kind: 'missed',
          hidden: false,
          at: 1200,
        },
      ]);
    });

    it('mistakes can include the ones corrected during the take', async () => {
      await db.recordTake(
        take({
          words: [word(2, 'mistake', 1200), word(3, 'corrected', 1300)],
        }),
      );
      expect((await db.mistakes()).map(m => m.word)).toEqual([2]);
      expect(
        (await db.mistakes({includeCorrected: true})).map(m => m.word),
      ).toEqual([3, 2]);
    });

    it("wordResults gives an ayah's word-by-word history across takes", async () => {
      await db.recordTake(
        take({
          id: 'a',
          words: [word(1, 'correct', 1100), word(2, 'mistake', 1200)],
        }),
      );
      await db.recordTake(
        take({id: 'b', startedAt: 5000, words: [word(2, 'correct', 5200)]}),
      );
      const rows = await db.wordResults(67, 1);
      expect(rows.map(r => [r.takeId, r.word, r.result])).toEqual([
        ['a', 1, 'correct'],
        ['a', 2, 'mistake'],
        ['b', 2, 'correct'],
      ]);
    });

    it('saving a take again replaces its words', async () => {
      await db.recordTake(take({words: [word(2, 'mistake', 1200)]}));
      await db.recordTake(take({words: [word(2, 'corrected', 1300)]}));
      expect(await db.mistakes()).toEqual([]);
      expect(await db.wordResults(67, 1)).toHaveLength(1);
    });

    it('a take without word results still saves', async () => {
      await db.recordTake(take({}));
      expect(await db.recentTakes(5)).toHaveLength(1);
      expect(await db.mistakes()).toEqual([]);
    });

    it('clearHistory also removes word results', async () => {
      await db.recordTake(take({words: [word(2, 'mistake', 1200)]}));
      await db.clearHistory();
      expect(await db.mistakes()).toEqual([]);
    });

    it('an existing history from before word results keeps its takes', async () => {
      const SQLite = jest.requireMock<{
        openDatabaseAsync: (name: string) => Promise<{
          execAsync: (sql: string) => Promise<void>;
          closeAsync: () => Promise<void>;
        }>;
      }>('expo-sqlite');
      // A version 2 history: the first database, then dismissals.
      const old = new RecitationLogDatabase();
      await old.recordTake(TAKE_A);
      const raw = await SQLite.openDatabaseAsync('recitation-log.db');
      await raw.execAsync(
        'DROP TABLE IF EXISTS word_results; PRAGMA user_version = 2;',
      );
      await closeOpenDatabases();
      db = new RecitationLogDatabase();
      await db.recordTake(
        take({id: 'new', startedAt: 9000, words: [word(2, 'mistake', 9100)]}),
      );
      expect((await db.recentTakes(5)).map(t => t.id)).toEqual(['new', 'a']);
      expect(await db.mistakes()).toHaveLength(1);
    });
  });
});
