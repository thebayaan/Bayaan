// @ai-generated
/**
 * WordReadingsService: how each of the 8 bundled rewayat reads a Hafs word,
 * from the per-word readings index (dk_readings.db, wordReadingsFormat.ts).
 *
 * - One query per Hafs verse (`SELECT ... FROM slots WHERE verse_key = ?`,
 *   a primary-key prefix), decoded at once and kept in an LRU of verses
 *   (64 by default). request() starts it; peek() and getStatus() read what
 *   is there and never load (safe during a render); subscribe() / getVersion()
 *   follow every change (useSyncExternalStore).
 * - request() never rejects: a failed read leaves the verse in 'error' until
 *   retry(). getWordReadings() / getWbwWordReadings() reject instead.
 * - Fail closed. Once per instance the index's info is checked: its format,
 *   its member order and the sha256 of the 8 words DBs it was built from,
 *   which must be the bundled ones (rewayahDataManifest.ts). When they are
 *   not, every verse reports 'error' and readings from another data build
 *   are never shown. A malformed row fails its own word only: that word's
 *   readings are not shown and nothing is guessed. A word with no row reads
 *   the same way in all 8 rewayat.
 */
import {
  digitalKhattDataService,
  getBundledAssetSha256,
} from './DigitalKhattDataService';
import {
  alikeReadings,
  combineReadings,
  decodeReadingsRow,
  dkPositionsForWbwWord,
  parseReadingsInfo,
  READINGS_FORMAT,
  READINGS_REWAYAT,
  ReadingsFormatError,
  type WordReadings,
} from './wordReadingsFormat';

export interface ReadingsSlotRecord {
  position: number;
  word_id: number;
  data: string;
}

/** The two reads the service needs (a fake in tests). */
export interface ReadingsDbReader {
  readInfo(): Promise<readonly {key: string; value: string}[]>;
  /** The rows of one Hafs verse; [] when none of its words has a row. */
  readVerse(hafsVerseKey: string): Promise<readonly ReadingsSlotRecord[]>;
}

// A damaged copy can return rows with NULL fields: throwing inside the read
// makes readAuxDb delete and re-import the copy and read it once more.
function checkedSlots(rows: readonly unknown[]): ReadingsSlotRecord[] {
  return rows.map(row => {
    const r = row as Partial<ReadingsSlotRecord> | null;
    if (
      !r ||
      !Number.isInteger(r.position) ||
      !Number.isInteger(r.word_id) ||
      typeof r.data !== 'string'
    ) {
      throw new Error('slots table has a malformed row');
    }
    // Number.isInteger does not narrow: both were just checked
    return {
      position: r.position as number,
      word_id: r.word_id as number,
      data: r.data,
    };
  });
}

/** The bundled index, read through DigitalKhattDataService.readAuxDb. */
export const dkReadingsDbReader: ReadingsDbReader = {
  readInfo: () =>
    digitalKhattDataService.readAuxDb('readings', async db => {
      const rows = await db.getAllAsync<{key: unknown; value: unknown}>(
        'SELECT key, value FROM info;',
      );
      if (
        rows.length === 0 ||
        rows.some(r => typeof r.key !== 'string' || typeof r.value !== 'string')
      ) {
        throw new Error('info table is empty or malformed');
      }
      return rows as {key: string; value: string}[];
    }),
  readVerse: hafsVerseKey =>
    digitalKhattDataService.readAuxDb('readings', async db =>
      checkedSlots(
        await db.getAllAsync<unknown>(
          'SELECT position, word_id, data FROM slots WHERE verse_key = ?;',
          [hafsVerseKey],
        ),
      ),
    ),
};

/** The words DBs whose sha256 the index records and the app bundles. */
export const READINGS_WORDS_DB_FILES = [
  'digital-khatt-v2.db',
  'dk_words_shouba.db',
  'dk_words_bazzi.db',
  'dk_words_qumbul.db',
  'dk_words_warsh.db',
  'dk_words_qaloon.db',
  'dk_words_doori.db',
  'dk_words_soosi.db',
] as const;

function bundledWordsDbHashes(): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const file of READINGS_WORDS_DB_FILES) {
    const sha = getBundledAssetSha256(file);
    if (sha) out[file] = sha;
  }
  return out;
}

export interface VerseReadings {
  readonly verseKey: string;
  /** Decoded rows by Hafs DK position (both positions of a span). */
  readonly byPosition: ReadonlyMap<number, WordReadings>;
  /** Positions whose row is malformed: those words show no readings. */
  readonly failed: ReadonlyMap<number, ReadingsFormatError>;
}

export type VerseReadingsStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The readings of the DK slots `positions` of a loaded verse: a word with no
 * row reads alike; a word over several slots combines them. Throws
 * ReadingsFormatError for a malformed row (that word only).
 */
export function readingsAt(
  verse: VerseReadings,
  positions: readonly number[],
): WordReadings {
  const parts = positions.map(position => {
    const failed = verse.failed.get(position);
    if (failed) throw failed;
    return (
      verse.byPosition.get(position) ??
      alikeReadings(verse.verseKey, [position])
    );
  });
  return combineReadings(parts);
}

function decodeVerse(
  verseKey: string,
  records: readonly ReadingsSlotRecord[],
): VerseReadings {
  const byPosition = new Map<number, WordReadings>();
  const failed = new Map<number, ReadingsFormatError>();
  for (const record of records) {
    try {
      byPosition.set(
        record.position,
        decodeReadingsRow(
          verseKey,
          record.position,
          record.word_id,
          record.data,
        ),
      );
    } catch (error) {
      const formatError =
        error instanceof ReadingsFormatError
          ? error
          : new ReadingsFormatError(
              `${verseKey}:${record.position}`,
              String(error),
            );
      failed.set(record.position, formatError);
      console.error('[WordReadingsService] Malformed row:', formatError);
    }
  }
  return {verseKey, byPosition, failed};
}

const DEFAULT_MAX_VERSES = 64;

export interface WordReadingsServiceOptions {
  /** Verses kept in memory (least recently requested go first). */
  maxVerses?: number;
  /** sha256 of the words DBs the index must have been built from. */
  expectedInputs?: () => Readonly<Record<string, string>>;
}

export class WordReadingsService {
  private readonly reader: ReadingsDbReader;
  private readonly maxVerses: number;
  private readonly expectedInputs: () => Readonly<Record<string, string>>;
  // Insertion order is recency order (request() re-inserts).
  private readonly verses = new Map<string, VerseReadings>();
  private readonly loading = new Map<string, Promise<VerseReadings | null>>();
  private readonly errors = new Map<string, unknown>();
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private guardPassed = false;
  private guardRefusal: Error | null = null;
  private guardInFlight: Promise<void> | null = null;

  constructor(
    reader: ReadingsDbReader = dkReadingsDbReader,
    options: WordReadingsServiceOptions = {},
  ) {
    this.reader = reader;
    this.maxVerses = Math.max(1, options.maxVerses ?? DEFAULT_MAX_VERSES);
    this.expectedInputs = options.expectedInputs ?? bundledWordsDbHashes;
  }

  /** Loads the readings of Hafs verse `verseKey` (one query). Never rejects:
   *  null when it failed (getStatus 'error'). */
  request(verseKey: string): Promise<VerseReadings | null> {
    const cached = this.verses.get(verseKey);
    if (cached) {
      this.verses.delete(verseKey);
      this.verses.set(verseKey, cached);
      return Promise.resolve(cached);
    }
    const inFlight = this.loading.get(verseKey);
    if (inFlight) return inFlight;
    if (this.errors.has(verseKey)) return Promise.resolve(null);
    const task = this.load(verseKey);
    this.loading.set(verseKey, task);
    this.notify();
    return task;
  }

  /** The loaded readings of a verse, or null. Never loads. */
  peek(verseKey: string): VerseReadings | null {
    return this.verses.get(verseKey) ?? null;
  }

  getStatus(verseKey: string): VerseReadingsStatus {
    if (this.verses.has(verseKey)) return 'ready';
    if (this.loading.has(verseKey)) return 'loading';
    if (this.errors.has(verseKey)) return 'error';
    return 'idle';
  }

  getError(verseKey: string): unknown {
    return this.errors.get(verseKey) ?? null;
  }

  /** Forgets a failure and loads the verse again. */
  retry(verseKey: string): Promise<VerseReadings | null> {
    if (this.errors.delete(verseKey)) this.notify();
    return this.request(verseKey);
  }

  /** The readings of Hafs word "s:a:w". Rejects when they cannot be shown. */
  async getWordReadings(hafsLocation: string): Promise<WordReadings> {
    const match = /^(\d+:\d+):(\d+)$/.exec(hafsLocation);
    if (!match) {
      throw new ReadingsFormatError(hafsLocation, 'not a word location');
    }
    return this.readingsOf(match[1], [Number(match[2])]);
  }

  /** The readings of the word at word-by-word position `wbwPosition`. */
  getWbwWordReadings(
    verseKey: string,
    wbwPosition: number,
  ): Promise<WordReadings> {
    return this.readingsOf(
      verseKey,
      dkPositionsForWbwWord(verseKey, wbwPosition),
    );
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Changes whenever subscribers are called. */
  readonly getVersion = (): number => this.version;

  private async readingsOf(
    verseKey: string,
    positions: readonly number[],
  ): Promise<WordReadings> {
    const verse =
      this.getStatus(verseKey) === 'error'
        ? await this.retry(verseKey)
        : await this.request(verseKey);
    if (!verse) {
      const error = this.errors.get(verseKey);
      throw error instanceof Error
        ? error
        : new Error(`[WordReadings] ${verseKey}: readings unavailable`);
    }
    return readingsAt(verse, positions);
  }

  private async load(verseKey: string): Promise<VerseReadings | null> {
    try {
      await this.ensureGuard();
      const verse = decodeVerse(
        verseKey,
        await this.reader.readVerse(verseKey),
      );
      this.verses.set(verseKey, verse);
      while (this.verses.size > this.maxVerses) {
        const oldest = this.verses.keys().next().value as string;
        this.verses.delete(oldest);
      }
      return verse;
    } catch (error) {
      this.errors.set(verseKey, error);
      if (!(error instanceof ReadingsGuardError)) {
        console.warn(
          `[WordReadingsService] Reading ${verseKey} failed:`,
          error,
        );
      }
      return null;
    } finally {
      this.loading.delete(verseKey);
      this.notify();
    }
  }

  // The info check, once per instance. A read failure is tried again by the
  // next load; a mismatch is final (the index belongs to another build).
  private ensureGuard(): Promise<void> {
    if (this.guardPassed) return Promise.resolve();
    if (this.guardRefusal) return Promise.reject(this.guardRefusal);
    if (!this.guardInFlight) {
      const run = this.reader.readInfo().then(rows => {
        const refusal = checkInfo(rows, this.expectedInputs());
        if (refusal) {
          this.guardRefusal = new ReadingsGuardError(refusal);
          console.error(
            `[WordReadingsService] The readings index is refused: ${refusal}`,
          );
          throw this.guardRefusal;
        }
        this.guardPassed = true;
      });
      this.guardInFlight = run;
      run.then(
        () => undefined,
        () => {
          if (this.guardInFlight === run) this.guardInFlight = null;
        },
      );
    }
    return this.guardInFlight;
  }

  private notify(): void {
    this.version += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

/** The index belongs to another data build: its readings are never shown. */
export class ReadingsGuardError extends Error {
  constructor(message: string) {
    super(`[WordReadings] ${message}`);
    this.name = 'ReadingsGuardError';
    Object.setPrototypeOf(this, ReadingsGuardError.prototype);
  }
}

/** Why the index's info is refused, or null when it is this build's. */
function checkInfo(
  rows: readonly {key: string; value: string}[],
  expected: Readonly<Record<string, string>>,
): string | null {
  let info;
  try {
    info = parseReadingsInfo(rows);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  if (info.format !== READINGS_FORMAT) {
    return `format ${info.format}, expected ${READINGS_FORMAT}`;
  }
  if (info.rewayat.join(',') !== READINGS_REWAYAT.join(',')) {
    return `member order ${info.rewayat.join(',')}`;
  }
  for (const file of READINGS_WORDS_DB_FILES) {
    const want = expected[file];
    if (!want || info.inputs[file] !== want) {
      return `built from another ${file}`;
    }
  }
  return null;
}

export const wordReadingsService = new WordReadingsService();
