// @ai-generated
/**
 * Arabic word meanings (gharib) and rasm for the word view, from the bundled
 * databases of services/wordStudy/bundledWordStudy.ts (built by
 * scripts/word-study/). Keys are Hafs "s:a:w" in the word-by-word (i'rab)
 * numbering; see wordStudyFormat.ts.
 *
 * Opens nothing at app start. Each database opens on first use, like
 * IrabDataService: when its meta.format is not the expected one (a first run
 * leaves an empty file), the file is deleted and imported from the asset,
 * then the old names are deleted. The service never rejects: a kind that
 * does not ship, or fails to open, reads as empty, and a failed open is
 * tried again on the next call.
 */
import * as SQLite from 'expo-sqlite';
import {parseWordKey} from '@/services/irab/irabFormat';
import {
  BUNDLED_WORD_STUDY,
  type BundledDb,
  type BundledWordStudy,
} from './bundledWordStudy';
import {
  decodeRasmNotes,
  emptyVerseStudy,
  gharibForWord,
  rasmForWord,
  type GharibEntry,
  type HafsWordKey,
  type VerseWordStudy,
  type WordRasm,
  type WordStudyKind,
  type WordStudySource,
} from './wordStudyFormat';

/** The meta.format this app reads. */
const FORMAT = '1';

interface Handle {
  db: SQLite.SQLiteDatabase;
  /** Sources by id, in display order. */
  sources: Map<number, WordStudySource>;
}

interface SourceRow {
  id: number;
  ord: number;
  name_ar: string;
  name_en: string;
  author_ar: string;
  author_en: string;
  via_ar: string;
  via_en: string;
  url: string;
  version: string;
}

interface GharibRow {
  source_id: number;
  ord: number;
  word_from: number | null;
  word_to: number | null;
  headword: string;
  gloss: string;
  note: string;
  part: string;
  page: string;
}

interface RasmRow {
  word_from: number;
  word_to: number;
  imlaei: string;
  notes: string;
  reviewed: number;
}

export class WordStudyDataService {
  private readonly dbs: Readonly<BundledWordStudy>;
  private readonly handles: Partial<Record<WordStudyKind, Handle>> = {};
  private readonly opening: Partial<
    Record<WordStudyKind, Promise<Handle | null>>
  > = {};
  private readonly verseCache = new Map<string, VerseWordStudy>();

  constructor(dbs: Readonly<BundledWordStudy> = BUNDLED_WORD_STUDY) {
    this.dbs = dbs;
  }

  /** Whether this build ships the kind. No I/O. */
  ships(kind: WordStudyKind): boolean {
    return this.dbs[kind] !== null;
  }

  /**
   * Gharib entries and rasm units of a Hafs verse, cached per verse. Never
   * rejects; a kind that does not ship or fails to open reads as empty, and
   * such a result is not cached.
   */
  async getVerse(verseKey: string): Promise<VerseWordStudy> {
    const cached = this.verseCache.get(verseKey);
    if (cached) return cached;
    try {
      const [gharib, rasm] = await Promise.all([
        this.loadGharib(verseKey),
        this.loadRasm(verseKey),
      ]);
      const verse: VerseWordStudy = {
        verseKey,
        gharib: gharib ?? [],
        rasm: rasm ?? [],
      };
      if (gharib !== null && rasm !== null)
        this.verseCache.set(verseKey, verse);
      return verse;
    } catch (error) {
      console.warn('[WordStudyDataService] getVerse failed:', error);
      return emptyVerseStudy(verseKey);
    }
  }

  /** Entries explaining the word; [] hides the section. */
  async getGharib(hafsLocation: HafsWordKey): Promise<GharibEntry[]> {
    const key = parseWordKey(hafsLocation);
    if (!key) return [];
    return gharibForWord(await this.getVerse(key.verseKey), key.position);
  }

  /** The rasm unit holding the word; null hides the section. */
  async getRasm(hafsLocation: HafsWordKey): Promise<WordRasm | null> {
    const key = parseWordKey(hafsLocation);
    if (!key) return null;
    return rasmForWord(await this.getVerse(key.verseKey), key.position);
  }

  /** [] when the kind does not ship; null when it ships but failed. */
  private async loadGharib(verseKey: string): Promise<GharibEntry[] | null> {
    if (!this.dbs.gharib) return [];
    const handle = await this.handle('gharib');
    if (!handle) return null;
    try {
      const rows = await handle.db.getAllAsync<GharibRow>(
        `SELECT g.source_id, g.ord, g.word_from, g.word_to,
                h.text AS headword, x.text AS gloss, n.text AS note, g.part, g.page
           FROM gharib g
           JOIN sources s ON s.id = g.source_id
           JOIN texts h ON h.id = g.headword_id
           JOIN texts x ON x.id = g.gloss_id
           JOIN texts n ON n.id = g.note_id
          WHERE g.verse_key = ?
          ORDER BY s.ord, g.ord`,
        [verseKey],
      );
      const entries: GharibEntry[] = [];
      for (const row of rows) {
        const source = handle.sources.get(row.source_id);
        if (!source) continue;
        entries.push({
          source,
          verseKey,
          ord: row.ord,
          span:
            row.word_from !== null && row.word_to !== null
              ? [row.word_from, row.word_to]
              : null,
          headword: row.headword,
          gloss: row.gloss,
          note: row.note,
          part: row.part,
          page: row.page,
        });
      }
      return entries;
    } catch (error) {
      console.warn('[WordStudyDataService] gharib query failed:', error);
      return null;
    }
  }

  private async loadRasm(verseKey: string): Promise<WordRasm[] | null> {
    if (!this.dbs.rasm) return [];
    const handle = await this.handle('rasm');
    if (!handle) return null;
    const source = handle.sources.values().next().value;
    if (!source) return [];
    try {
      const rows = await handle.db.getAllAsync<RasmRow>(
        `SELECT word_from, word_to, imlaei, notes, reviewed
           FROM rasm WHERE verse_key = ? ORDER BY word_from`,
        [verseKey],
      );
      return rows.map(row => ({
        source,
        verseKey,
        from: row.word_from,
        to: row.word_to,
        imlaei: row.imlaei,
        notes: decodeRasmNotes(row.notes),
        reviewed: row.reviewed === 1,
      }));
    } catch (error) {
      console.warn('[WordStudyDataService] rasm query failed:', error);
      return null;
    }
  }

  /** The open database of a kind; null when it cannot be opened now. */
  private handle(kind: WordStudyKind): Promise<Handle | null> {
    const ready = this.handles[kind];
    if (ready) return Promise.resolve(ready);
    const bundled = this.dbs[kind];
    if (!bundled) return Promise.resolve(null);
    let pending = this.opening[kind];
    if (!pending) {
      pending = this.open(kind, bundled)
        .then(handle => {
          this.handles[kind] = handle;
          return handle;
        })
        .catch((error: unknown) => {
          console.warn(`[WordStudyDataService] ${bundled.name}:`, error);
          return null;
        })
        .finally(() => {
          delete this.opening[kind];
        });
      this.opening[kind] = pending;
    }
    return pending;
  }

  private async open(kind: WordStudyKind, bundled: BundledDb): Promise<Handle> {
    let db = await SQLite.openDatabaseAsync(bundled.name);
    if (!(await hasFormat(db))) {
      await db.closeAsync();
      await SQLite.deleteDatabaseAsync(bundled.name);
      await SQLite.importDatabaseFromAssetAsync(bundled.name, {
        assetId: bundled.assetId,
      });
      db = await SQLite.openDatabaseAsync(bundled.name);
      for (const old of bundled.old) {
        await SQLite.deleteDatabaseAsync(old).catch(() => undefined);
      }
      if (!(await hasFormat(db))) {
        await db.closeAsync();
        throw new Error(`${bundled.name}: not a word-study database`);
      }
    }
    const rows = await db.getAllAsync<SourceRow>(
      'SELECT * FROM sources ORDER BY ord, id',
    );
    const sources = new Map<number, WordStudySource>();
    for (const r of rows) {
      sources.set(r.id, {
        id: r.id,
        kind,
        ord: r.ord,
        nameAr: r.name_ar,
        nameEn: r.name_en,
        authorAr: r.author_ar,
        authorEn: r.author_en,
        viaAr: r.via_ar,
        viaEn: r.via_en,
        url: r.url,
        version: r.version,
      });
    }
    return {db, sources};
  }
}

async function hasFormat(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const row = await db
    .getFirstAsync<{
      value: string;
    }>("SELECT value FROM meta WHERE key = 'format'")
    .catch(() => null);
  return row?.value === FORMAT;
}

export const wordStudyDataService = new WordStudyDataService();
