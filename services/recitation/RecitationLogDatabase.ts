import * as SQLite from 'expo-sqlite';
import type {SessionPurpose} from './activeSession';
import type {ShownFlag} from './flags';
import type {TakeRecord, TakeWord} from './take';

// The reader's recitation history, on the phone only: one row per take, one
// row per ayah a take touched (recited, flagged or peeked at), and one row
// per word the engine judged (correct, unclear, a mistake, or a mistake
// corrected in the take). Events only, never audio. Revision features read
// the per-ayah rows; mistake history and weak-word features read the words.

const DB_NAME = 'recitation-log.db';
const SCHEMA_VERSION = 3;

export interface TakeSummary {
  id: string;
  purpose: SessionPurpose;
  startedAt: number;
  endedAt: number;
  hidden: boolean;
  ayatCount: number;
  flagCount: number;
  peekCount: number;
  stallCount: number;
}

export interface AyahHistoryRow {
  takeId: string;
  /** When the take started. */
  recitedAt: number;
  /** False when the take only flagged or peeked at the ayah. */
  recited: boolean;
  hidden: boolean;
  flags: number;
  peeks: number;
  stalls: number;
}

/** One judged word of one take. `word` is its 1-based position (Hafs). */
export interface WordResultRow {
  takeId: string;
  surah: number;
  ayah: number;
  word: number;
  result: TakeWord['result'];
  kind: TakeWord['kind'];
  hidden: boolean;
  at: number;
}

interface WordRow {
  take_id: string;
  surah: number;
  ayah: number;
  word: number;
  result: TakeWord['result'];
  kind: TakeWord['kind'];
  hidden: number;
  at: number;
}

function toWordResult(row: WordRow): WordResultRow {
  return {
    takeId: row.take_id,
    surah: row.surah,
    ayah: row.ayah,
    word: row.word,
    result: row.result,
    kind: row.kind,
    hidden: row.hidden === 1,
    at: row.at,
  };
}

interface TakeSummaryRow {
  id: string;
  purpose: SessionPurpose;
  started_at: number;
  ended_at: number;
  hidden: number;
  ayat_count: number;
  flag_count: number;
  peek_count: number;
  stall_count: number;
}

interface AyahRow {
  take_id: string;
  recited_at: number;
  recited: number;
  hidden: number;
  flags: number;
  peeks: number;
  stalls: number;
}

interface AyahTally {
  surah: number;
  ayah: number;
  recited: boolean;
  flags: number;
  peeks: number;
  stalls: number;
}

/** One tally per ayah the take touched: recited ayat first, in order. */
function tallyAyat(take: TakeRecord): AyahTally[] {
  const tallies = new Map<string, AyahTally>();
  const tally = (surah: number, ayah: number): AyahTally => {
    const key = `${surah}:${ayah}`;
    let entry = tallies.get(key);
    if (!entry) {
      entry = {surah, ayah, recited: false, flags: 0, peeks: 0, stalls: 0};
      tallies.set(key, entry);
    }
    return entry;
  };
  for (const a of take.ayat) tally(a.surah, a.ayah).recited = true;
  for (const f of take.flags) tally(f.surah, f.ayah).flags += 1;
  for (const p of take.peeks) tally(p.surah, p.ayah).peeks += 1;
  for (const s of take.stalls) tally(s.surah, s.ayah).stalls += 1;
  return [...tallies.values()];
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{user_version: number}>(
    'PRAGMA user_version',
  );
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;
  if (version < 1) await createTakeTables(db);
  if (version < 2) {
    // "I read it correctly": flags the reader dismissed stay hidden.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS dismissed_flags (
        key TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        surah INTEGER NOT NULL,
        ayah INTEGER NOT NULL,
        word INTEGER NOT NULL,
        dismissed_at INTEGER NOT NULL
      );
    `);
  }
  if (version < 3) await createWordTable(db);
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

async function createWordTable(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS word_results (
      take_id TEXT NOT NULL,
      surah INTEGER NOT NULL,
      ayah INTEGER NOT NULL,
      word INTEGER NOT NULL,
      result TEXT NOT NULL,
      kind TEXT,
      hidden INTEGER NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY (take_id, surah, ayah, word)
    );
    CREATE INDEX IF NOT EXISTS idx_word_results_word
      ON word_results(surah, ayah, word, at);
    CREATE INDEX IF NOT EXISTS idx_word_results_result
      ON word_results(result, at);
  `);
}

async function createTakeTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS takes (
      id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      hidden INTEGER NOT NULL,
      stop_reason TEXT NOT NULL,
      ayat_count INTEGER NOT NULL,
      flag_count INTEGER NOT NULL,
      peek_count INTEGER NOT NULL,
      stall_count INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_takes_started ON takes(started_at);
    CREATE TABLE IF NOT EXISTS take_ayat (
      take_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      surah INTEGER NOT NULL,
      ayah INTEGER NOT NULL,
      recited INTEGER NOT NULL,
      hidden INTEGER NOT NULL,
      flags INTEGER NOT NULL,
      peeks INTEGER NOT NULL,
      stalls INTEGER NOT NULL,
      recited_at INTEGER NOT NULL,
      PRIMARY KEY (take_id, ordinal)
    );
    CREATE INDEX IF NOT EXISTS idx_take_ayat_verse
      ON take_ayat(surah, ayah, recited_at);
  `);
}

export class RecitationLogDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;

  private async open(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) return this.db;
    this.opening ??= (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        await db.execAsync('PRAGMA journal_mode = WAL;');
        await migrate(db);
        this.db = db;
        return db;
      } catch (error) {
        this.opening = null;
        throw error;
      }
    })();
    return this.opening;
  }

  /** Saves a finished take. Takes that touched no ayah are dropped. */
  async recordTake(take: TakeRecord): Promise<void> {
    const tallies = tallyAyat(take);
    if (tallies.length === 0) return;
    const db = await this.open();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT OR REPLACE INTO takes (id, purpose, started_at, ended_at,
           hidden, stop_reason, ayat_count, flag_count, peek_count,
           stall_count, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        take.id,
        take.purpose,
        take.startedAt,
        take.endedAt,
        take.hidden ? 1 : 0,
        take.stopReason,
        take.ayat.length,
        take.flags.length,
        take.peeks.length,
        take.stalls.length,
        JSON.stringify(take),
      );
      await db.runAsync('DELETE FROM take_ayat WHERE take_id = ?', take.id);
      for (const [ordinal, t] of tallies.entries()) {
        await db.runAsync(
          `INSERT INTO take_ayat (take_id, ordinal, surah, ayah, recited,
             hidden, flags, peeks, stalls, recited_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          take.id,
          ordinal,
          t.surah,
          t.ayah,
          t.recited ? 1 : 0,
          take.hidden ? 1 : 0,
          t.flags,
          t.peeks,
          t.stalls,
          take.startedAt,
        );
      }
      await db.runAsync('DELETE FROM word_results WHERE take_id = ?', take.id);
      for (const w of take.words ?? []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO word_results (take_id, surah, ayah, word,
             result, kind, hidden, at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          take.id,
          w.surah,
          w.ayah,
          w.word,
          w.result,
          w.kind,
          w.hidden ? 1 : 0,
          w.at,
        );
      }
    });
  }

  /**
   * Every mistake ever marked, newest first.
   * @param options.includeCorrected - Also the ones fixed within the take
   */
  async mistakes(
    options: {includeCorrected?: boolean; limit?: number} = {},
  ): Promise<WordResultRow[]> {
    const db = await this.open();
    const results = options.includeCorrected
      ? "('mistake', 'corrected')"
      : "('mistake')";
    const rows = await db.getAllAsync<WordRow>(
      `SELECT * FROM word_results WHERE result IN ${results}
       ORDER BY at DESC LIMIT ?`,
      options.limit ?? -1,
    );
    return rows.map(toWordResult);
  }

  /** The reader said a marked word of a saved take was read correctly. */
  async dismissWord(
    takeId: string,
    surah: number,
    ayah: number,
    word: number,
  ): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      `UPDATE word_results SET result = 'dismissed'
       WHERE take_id = ? AND surah = ? AND ayah = ? AND word = ?`,
      takeId,
      surah,
      ayah,
      word,
    );
  }

  /** Every judged word of one ayah, oldest first: its history word by word. */
  async wordResults(surah: number, ayah: number): Promise<WordResultRow[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<WordRow>(
      `SELECT * FROM word_results WHERE surah = ? AND ayah = ?
       ORDER BY at, word`,
      surah,
      ayah,
    );
    return rows.map(toWordResult);
  }

  /** The latest takes, newest first. */
  async recentTakes(limit: number): Promise<TakeSummary[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<TakeSummaryRow>(
      `SELECT id, purpose, started_at, ended_at, hidden, ayat_count,
         flag_count, peek_count, stall_count
       FROM takes ORDER BY started_at DESC LIMIT ?`,
      limit,
    );
    return rows.map(row => ({
      id: row.id,
      purpose: row.purpose,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      hidden: row.hidden === 1,
      ayatCount: row.ayat_count,
      flagCount: row.flag_count,
      peekCount: row.peek_count,
      stallCount: row.stall_count,
    }));
  }

  async getTake(id: string): Promise<TakeRecord | null> {
    const db = await this.open();
    const row = await db.getFirstAsync<{payload: string}>(
      'SELECT payload FROM takes WHERE id = ?',
      id,
    );
    return row ? (JSON.parse(row.payload) as TakeRecord) : null;
  }

  /** Every take that started at or after `since`, oldest first. */
  async takesSince(since: number): Promise<TakeRecord[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<{payload: string}>(
      'SELECT payload FROM takes WHERE started_at >= ? ORDER BY started_at ASC',
      since,
    );
    return rows.map(row => JSON.parse(row.payload) as TakeRecord);
  }

  /** Every take that touched this ayah, newest first. */
  async ayahHistory(
    surah: number,
    ayah: number,
    limit = 100,
  ): Promise<AyahHistoryRow[]> {
    const db = await this.open();
    const rows = await db.getAllAsync<AyahRow>(
      `SELECT take_id, recited_at, recited, hidden, flags, peeks, stalls
       FROM take_ayat WHERE surah = ? AND ayah = ?
       ORDER BY recited_at DESC LIMIT ?`,
      surah,
      ayah,
      limit,
    );
    return rows.map(row => ({
      takeId: row.take_id,
      recitedAt: row.recited_at,
      recited: row.recited === 1,
      hidden: row.hidden === 1,
      flags: row.flags,
      peeks: row.peeks,
      stalls: row.stalls,
    }));
  }

  /** Remembers that the reader read this flag's spot correctly. */
  async dismiss(flag: ShownFlag): Promise<void> {
    const db = await this.open();
    await db.runAsync(
      `INSERT OR REPLACE INTO dismissed_flags
         (key, kind, surah, ayah, word, dismissed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      flag.key,
      flag.kind,
      flag.surah,
      flag.ayah,
      flag.word,
      Date.now(),
    );
  }

  /** Keys of every flag the reader dismissed (see flags.ts flagKey). */
  async dismissedKeys(): Promise<Set<string>> {
    const db = await this.open();
    const rows = await db.getAllAsync<{key: string}>(
      'SELECT key FROM dismissed_flags',
    );
    return new Set(rows.map(row => row.key));
  }

  /** Deletes the whole history, dismissals included. */
  async clearHistory(): Promise<void> {
    const db = await this.open();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM take_ayat');
      await db.runAsync('DELETE FROM word_results');
      await db.runAsync('DELETE FROM takes');
      await db.runAsync('DELETE FROM dismissed_flags');
    });
  }
}

export const recitationLogDatabase = new RecitationLogDatabase();
