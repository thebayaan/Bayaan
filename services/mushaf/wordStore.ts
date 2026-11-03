// @ai-generated
// RFC-023 step 2: the words are read when a page or a verse needs them, not
// all at load. A load takes a verse index (the first and last word id of each
// of the 6,236 verses; mushafTables.ts) and native integrity counts, and keeps
// the connection open. A getter reads the WORD_CHUNK ids around a word with
// getFirstSync, so every getter stays synchronous.
//
// In every bundled words DB the ids run 1..n with no gaps, each verse is one
// id range, and location is "surah:ayah:(id - first id of the verse + 1)". The
// *.alldbs test checks that, and that every getter gives what a full read of
// the table gives.
//
// A chunk read asks for one string: the texts in id order, joined by U+001F
// (no text holds it). words.id is the INTEGER PRIMARY KEY, so the read seeks.
// On a Samsung A10s, 2,048 rows as objects (getAllSync) took 119-151 ms; the
// joined string takes 7-11 ms. A word's verse and position come from the verse
// index, so the read needs no location column.
import type * as SQLite from 'expo-sqlite';
import type {DKWordInfo} from './DigitalKhattDataService';

const WORD_CHUNK = 2048;
const WORD_SEPARATOR = '\u001f';
const WORD_CHUNK_QUERY =
  'SELECT group_concat(text, char(31) ORDER BY id) AS texts FROM words WHERE id BETWEEN ? AND ?;';
// Chunks kept per words DB (about 49k words; least recently used go first).
const MAX_WORD_CHUNKS = 24;
const MAX_VERSE_SLOTS = 1024;

/** A word of a words DB. readInOrder() reuses one object for all of them. */
export interface WordSlot {
  id: number;
  surah: number;
  ayah: number;
  word: number;
  text: string;
}

export interface VerseIndex {
  /** Verse keys ("2:255") in word-id order. */
  keys: string[];
  first: Int32Array;
  last: Int32Array;
  surah: Int32Array;
  ayah: Int32Array;
  byKey: Map<string, number>;
}

interface WordChunk {
  start: number;
  texts: string[];
  /** Built on first use (WordStore.info). */
  infos: (DKWordInfo | undefined)[];
}

export interface VerseRangeRow {
  surah: number;
  ayah: number;
  first: number;
  last: number;
}

const isWholeNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value);

/** A sweep could not read its words now. This says nothing about the data. */
export class WordReadError extends Error {
  constructor(dbName: string) {
    super(`[WordStore] Reading ${dbName} failed`);
    this.name = 'WordReadError';
    Object.setPrototypeOf(this, WordReadError.prototype);
  }
}

/**
 * Throws on a damaged copy of a words table (cut short, NULL fields), so the
 * copy is deleted, re-imported and read again inside the load.
 */
export async function checkWordsTable(
  db: SQLite.SQLiteDatabase,
  index: VerseIndex,
): Promise<void> {
  const counts = await db.getFirstAsync<{
    n: number;
    ids: number;
    texts: number;
    locations: number;
  }>(
    'SELECT COUNT(*) AS n, COUNT(id) AS ids, COUNT(text) AS texts, COUNT(location) AS locations FROM words;',
  );
  if (!counts || !counts.n) throw new Error('words table is empty');
  const expected = index.last[index.last.length - 1];
  if (
    counts.n !== expected ||
    counts.ids !== expected ||
    counts.texts !== expected ||
    counts.locations !== expected
  ) {
    throw new Error('words table has a malformed row');
  }
}

/** The verse index of `rows`; throws on a malformed or out-of-order row. */
export function buildVerseIndex(rows: readonly VerseRangeRow[]): VerseIndex {
  const n = rows.length;
  const index: VerseIndex = {
    keys: new Array<string>(n),
    first: new Int32Array(n),
    last: new Int32Array(n),
    surah: new Int32Array(n),
    ayah: new Int32Array(n),
    byKey: new Map(),
  };
  let previousLast = 0;
  for (let i = 0; i < n; i++) {
    const row = rows[i];
    if (
      !isWholeNumber(row.surah) ||
      !isWholeNumber(row.ayah) ||
      !isWholeNumber(row.first) ||
      !isWholeNumber(row.last) ||
      row.first <= previousLast ||
      row.last < row.first
    ) {
      throw new Error(`words table has a malformed verse (row ${i})`);
    }
    const key = `${row.surah}:${row.ayah}`;
    index.keys[i] = key;
    index.first[i] = row.first;
    index.last[i] = row.last;
    index.surah[i] = row.surah;
    index.ayah[i] = row.ayah;
    index.byKey.set(key, i);
    previousLast = row.last;
  }
  return index;
}

/** The index of the verse that holds `wordId`, or -1. */
function verseIndexOfWord(index: VerseIndex, wordId: number): number {
  let lo = 0;
  let hi = index.keys.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (wordId < index.first[mid]) hi = mid - 1;
    else if (wordId > index.last[mid]) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * The words of one words DB, read on demand from an open connection. The data
 * service owns it: close() releases the connection (and the DB name's open
 * count), after which every read returns nothing.
 *
 * The first failed read stops the store: `''` is also a real word text (7 of
 * the 8 words DBs have such words), so a getter cannot report a failure, and a
 * retry would read a broken copy again on every getter of a render. It tells
 * the service, which replaces the copy and makes the rewayah read 'error'.
 */
export class WordStore {
  private chunks = new Map<number, WordChunk>();
  private verseSlots = new Map<string, DKWordInfo[]>();
  private closed = false;
  private failed = false;

  constructor(
    readonly dbName: string,
    private readonly db: SQLite.SQLiteDatabase,
    readonly index: VerseIndex,
    private readonly release: (
      name: string,
      db: SQLite.SQLiteDatabase,
    ) => Promise<void>,
    private readonly onReadFailed: (store: WordStore, error: unknown) => void,
  ) {}

  /** A read failed: every text from now on is ''. */
  get hasFailed(): boolean {
    return this.failed;
  }

  get wordCount(): number {
    const n = this.index.keys.length;
    return n === 0 ? 0 : this.index.last[n - 1];
  }

  text(wordId: number): string {
    const chunk = this.chunkFor(wordId);
    return (chunk && chunk.texts[wordId - chunk.start]) || '';
  }

  info(wordId: number): DKWordInfo | undefined {
    const chunk = this.chunkFor(wordId);
    if (!chunk) return undefined;
    const offset = wordId - chunk.start;
    if (offset >= chunk.texts.length) return undefined;
    let info = chunk.infos[offset];
    if (!info) {
      const i = verseIndexOfWord(this.index, wordId);
      if (i < 0) return undefined;
      info = {
        text: chunk.texts[offset],
        verseKey: this.index.keys[i],
        wordPositionInVerse: wordId - this.index.first[i] + 1,
      };
      chunk.infos[offset] = info;
    }
    return info;
  }

  /** The verse's slots (blank ones too) by word position, or undefined. */
  verseWords(verseKey: string): DKWordInfo[] | undefined {
    const cached = this.verseSlots.get(verseKey);
    if (cached) {
      this.verseSlots.delete(verseKey);
      this.verseSlots.set(verseKey, cached);
      return cached;
    }
    const i = this.index.byKey.get(verseKey);
    if (i === undefined || this.closed) return undefined;
    const slots: DKWordInfo[] = [];
    for (let id = this.index.first[i]; id <= this.index.last[i]; id++) {
      const info = this.info(id);
      if (info && info.verseKey === verseKey) slots.push(info);
    }
    if (this.failed) return undefined; // Never keep a verse with words missing.
    slots.sort((a, b) => a.wordPositionInVerse - b.wordPositionInVerse);
    this.verseSlots.set(verseKey, slots);
    if (this.verseSlots.size > MAX_VERSE_SLOTS) {
      const oldest = this.verseSlots.keys().next().value;
      if (oldest !== undefined) this.verseSlots.delete(oldest);
    }
    return slots;
  }

  /** The surah of the verse that holds `wordId`. */
  surahOfWord(wordId: number): number | undefined {
    const i = verseIndexOfWord(this.index, wordId);
    return i < 0 ? undefined : this.index.surah[i];
  }

  /**
   * Every word in id order, read WORD_CHUNK ids at a time outside the chunk
   * cache, so a sweep (the verse-units build) evicts none of the reader's
   * chunks. It yields ONE reused object, and throws WordReadError after a
   * failed read or when the store closed meanwhile.
   */
  *readInOrder(): Generator<WordSlot> {
    const slot: WordSlot = {id: 0, surah: 0, ayah: 0, word: 0, text: ''};
    const total = this.wordCount;
    let verse = 0;
    for (let start = 1; start <= total; start += WORD_CHUNK) {
      const end = Math.min(start + WORD_CHUNK - 1, total);
      const texts = this.readChunk(start, end);
      if (!texts) throw new WordReadError(this.dbName);
      for (let offset = 0; offset < texts.length; offset++) {
        const id = start + offset;
        while (id > this.index.last[verse]) verse += 1;
        slot.id = id;
        slot.surah = this.index.surah[verse];
        slot.ayah = this.index.ayah[verse];
        slot.word = id - this.index.first[verse] + 1;
        slot.text = texts[offset];
        yield slot;
      }
    }
  }

  close(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.closed = true;
    this.chunks.clear();
    this.verseSlots.clear();
    return this.release(this.dbName, this.db);
  }

  private chunkFor(wordId: number): WordChunk | null {
    if (!Number.isInteger(wordId) || wordId < 1) return null;
    const k = Math.floor((wordId - 1) / WORD_CHUNK);
    const hit = this.chunks.get(k);
    if (hit) {
      this.chunks.delete(k);
      this.chunks.set(k, hit);
      return hit;
    }
    const start = k * WORD_CHUNK + 1;
    if (start > this.wordCount) return null;
    const end = Math.min(start + WORD_CHUNK - 1, this.wordCount);
    const texts = this.readChunk(start, end);
    if (!texts) return null;
    const chunk: WordChunk = {
      start,
      texts,
      infos: new Array(texts.length),
    };
    this.chunks.set(k, chunk);
    if (this.chunks.size > MAX_WORD_CHUNKS) {
      const oldest = this.chunks.keys().next().value;
      if (oldest !== undefined) this.chunks.delete(oldest);
    }
    return chunk;
  }

  // The texts of ids start..end, or null after a failed read.
  private readChunk(start: number, end: number): string[] | null {
    if (this.closed || this.failed) return null;
    try {
      const row = this.db.getFirstSync<{texts: string | null}>(
        WORD_CHUNK_QUERY,
        [start, end],
      );
      const texts = row?.texts == null ? [] : row.texts.split(WORD_SEPARATOR);
      // The ids of a chunk have no gaps: one text for each.
      if (texts.length !== end - start + 1) {
        throw new Error(`${texts.length} texts for ids ${start}..${end}`);
      }
      return texts;
    } catch (error) {
      this.failed = true;
      this.onReadFailed(this, error);
      return null;
    }
  }
}
