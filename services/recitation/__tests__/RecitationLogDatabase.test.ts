// The recitation log on a real SQLite file (better-sqlite3 behind the
// expo-sqlite mock).
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {closeOpenDatabases, resetDatabases} from '@/test-utils/mockExpoSqlite';
import {RecitationLogDatabase} from '../RecitationLogDatabase';
import type {TakeRecord} from '../take';

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
});
