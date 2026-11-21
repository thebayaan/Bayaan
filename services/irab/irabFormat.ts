/**
 * Reading the bundled i'rab database (assets/data/irab-v2.db, built by
 * scripts/irab/build-irab-db.ts).
 *
 * A word's entries are stored as `[kind, labelId, textId, spanFrom?, spanTo?]`
 * against a shared `texts` table. Texts refer to other words with
 * placeholders: `{{5}}` is word 5 of the same verse, `{{2:3:1}}` a word of
 * another verse. The app fills them with its own word text, so no Quran
 * spelling ever comes from the i'rab data.
 */

export type IrabEntryKind =
  | 'prefix'
  | 'stem'
  | 'suffix'
  | 'implied'
  | 'phrase'
  | 'alt';

export interface IrabEntry {
  kind: IrabEntryKind;
  /** Grammar name of the segment ("الواو", "واو الجماعة", "وجه آخر"). */
  label: string;
  text: string;
  /** Phrase entries: the first and last word ("s:a:w") of the phrase. */
  span?: [string, string];
}

/** One morphology (صرف) fact of a word: "الجذر" → "ك ت ب". */
export interface MorphFact {
  label: string;
  /** May hold word placeholders like an i'rab text. */
  value: string;
}

// @ai-start
/**
 * The labels scripts/irab/sarf.ts writes for a word's root (its letters
 * joined by spaces, ء for hamza: "ك ت ب") and its lemma. A word has at most
 * one of each; 20,586 words have no lemma.
 */
export const MORPH_ROOT_LABEL = 'الجذر';
export const MORPH_LEMMA_LABEL = 'الأصل المعجمي';
// @ai-end

export interface WordIrab {
  position: number;
  entries: IrabEntry[];
  /** Both independent analyses agree on this word's case and role. */
  agreed: boolean;
  /** Morphology of the word's main stem. */
  morph: MorphFact[];
}

const KINDS: Record<string, IrabEntryKind> = {
  p: 'prefix',
  s: 'stem',
  x: 'suffix',
  i: 'implied',
  h: 'phrase',
  a: 'alt',
};

/** Decodes one stored row. Unknown kinds or text ids are skipped. */
export function decodeEntries(
  json: string,
  texts: readonly string[],
): IrabEntry[] {
  let rows: unknown;
  try {
    rows = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const out: IrabEntry[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const kind = KINDS[row[0] as string];
    const label = texts[row[1] as number];
    const text = texts[row[2] as number];
    if (!kind || label === undefined || text === undefined) continue;
    const entry: IrabEntry = {kind, label, text};
    if (typeof row[3] === 'string' && typeof row[4] === 'string') {
      entry.span = [row[3], row[4]];
    }
    out.push(entry);
  }
  return out;
}

/** Decodes a stored `[[labelId, valueId], ...]` morphology row. */
export function decodeMorph(
  json: string,
  texts: readonly string[],
): MorphFact[] {
  let rows: unknown;
  try {
    rows = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const out: MorphFact[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const label = texts[row[0] as number];
    const value = texts[row[1] as number];
    if (label === undefined || value === undefined) continue;
    out.push({label, value});
  }
  return out;
}

/** A piece of an i'rab text: plain prose or a reference to a word. */
export type IrabTextPart =
  | {type: 'text'; text: string}
  | {type: 'ref'; verseKey: string; position: number};

/**
 * Splits a text at its word placeholders. `verseKey` is the verse the text
 * belongs to (for `{{5}}`).
 */
export function splitRefs(text: string, verseKey: string): IrabTextPart[] {
  const parts: IrabTextPart[] = [];
  const re = /\{\{(?:(\d+):(\d+):)?(\d+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last)
      parts.push({type: 'text', text: text.slice(last, m.index)});
    parts.push({
      type: 'ref',
      verseKey: m[1] ? `${m[1]}:${m[2]}` : verseKey,
      position: Number(m[3]),
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({type: 'text', text: text.slice(last)});
  return parts;
}

/** "2:3:5" → {verseKey: "2:3", position: 5}. */
export function parseWordKey(
  key: string,
): {verseKey: string; position: number} | null {
  const m = /^(\d+):(\d+):(\d+)$/.exec(key);
  return m ? {verseKey: `${m[1]}:${m[2]}`, position: Number(m[3])} : null;
}

/**
 * A word's mushaf text for quoting it inline: without its pause (waqf) marks
 * U+06D6 to U+06DB, the rub el hizb U+06DE and the sajdah sign U+06E9,
 * which belong to the place in the verse. Every other mark stays. U+06DC
 * (small high seen) is part of the word: the seen over the sad of 2:245:14
 * and 7:69:22 and the saktah sign of 18:1:11, 36:52:6, 69:28:4, 75:27:2 and
 * 83:14:2 (services/irab/__tests__/quotableWord.database.test.ts).
 */
export function quotableWord(text: string): string {
  return text
    .replace(/[\u06d6-\u06db\u06de\u06e9]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A classical i'rab book's passages for a verse. */
export interface IrabBookPassages {
  bookId: number;
  nameAr: string;
  authorAr: string;
  /** `id` names the passage: a page discussing several verses has one. */
  passages: {id: number; text: string; part: string; page: string}[];
}

/** Book passages and the verses (of those given) they discuss. */
export interface VerseBooksGroup {
  /** In the order given; a passage discusses a run of verses. */
  verseKeys: string[];
  books: IrabBookPassages[];
}

/**
 * The passages of several verses' books with each passage once: a page
 * that discusses 100:1 to 100:5 is linked to each of them. Each passage
 * goes into the group of exactly the verses that have it, and groups,
 * books and passages keep the order they first appear in, verse by verse.
 * A verse with no passage of its own makes no group.
 */
export function mergeBookPassages(
  parts: readonly {
    verseKey: string;
    books: readonly IrabBookPassages[];
  }[],
): VerseBooksGroup[] {
  const versesOf = new Map<number, string[]>();
  for (const part of parts) {
    for (const book of part.books) {
      for (const passage of book.passages) {
        const verses = versesOf.get(passage.id) ?? [];
        if (!verses.includes(part.verseKey)) verses.push(part.verseKey);
        versesOf.set(passage.id, verses);
      }
    }
  }
  const groups = new Map<string, VerseBooksGroup>();
  const placed = new Set<number>();
  for (const part of parts) {
    for (const book of part.books) {
      for (const passage of book.passages) {
        if (placed.has(passage.id)) continue;
        placed.add(passage.id);
        const verseKeys = versesOf.get(passage.id) ?? [part.verseKey];
        const key = verseKeys.join(',');
        let group = groups.get(key);
        if (!group) {
          group = {verseKeys, books: []};
          groups.set(key, group);
        }
        let shown = group.books.find(b => b.bookId === book.bookId);
        if (!shown) {
          shown = {...book, passages: []};
          group.books.push(shown);
        }
        shown.passages.push(passage);
      }
    }
  }
  return [...groups.values()];
}
