// @ai-generated
/**
 * The app's Hafs words, as the word-study builds compare them: every word of
 * data/wbw/wbw-en.db in its word-by-word (i'rab) numbering. A word whose
 * text holds U+FFFD (55 words, damaged when the file was fetched) takes the
 * Digital Khatt text at the same location: the two numberings differ only
 * in 2:181, 8:6 and 13:37, and no damaged word is in those verses (checked).
 */
import path from 'path';
import Database from 'better-sqlite3';
import type {AppWord} from './rasm';

export const APP_WORD_COUNT = 77429;
export const APP_VERSE_COUNT = 6236;

/** Verses where Digital Khatt splits بَعْدَ مَا and its numbering shifts. */
const DK_SHIFTED_VERSES = new Set(['2:181', '8:6', '13:37']);

export interface AppWords {
  /** "s:a" → the verse's words in order. */
  verses: Map<string, AppWord[]>;
  /** "s:a:w" of the words whose text came from Digital Khatt. */
  repaired: string[];
}

export function readAppWords(root: string): AppWords {
  const wbw = new Database(path.join(root, 'data/wbw/wbw-en.db'), {
    readonly: true,
  });
  const dk = new Database(
    path.join(root, 'data/mushaf/digitalkhatt/digital-khatt-v2.db'),
    {readonly: true},
  );
  try {
    const rows = wbw
      .prepare(
        'SELECT verse_key, position, text_uthmani FROM words ORDER BY id',
      )
      .all() as {verse_key: string; position: number; text_uthmani: string}[];
    const dkText = dk.prepare('SELECT text FROM words WHERE location = ?');
    const verses = new Map<string, AppWord[]>();
    const repaired: string[] = [];
    for (const row of rows) {
      const key = `${row.verse_key}:${row.position}`;
      let text = row.text_uthmani ?? '';
      if (text.includes('�')) {
        const dkRow = dkText.get(key) as {text: string} | undefined;
        if (DK_SHIFTED_VERSES.has(row.verse_key) || !dkRow) {
          throw new Error(`${key}: damaged word with no usable DK text`);
        }
        text = dkRow.text;
        repaired.push(key);
      }
      const list = verses.get(row.verse_key) ?? [];
      list.push({position: row.position, text});
      verses.set(row.verse_key, list);
    }
    const count = rows.length;
    if (count !== APP_WORD_COUNT || verses.size !== APP_VERSE_COUNT) {
      throw new Error(
        `wbw-en.db has ${count} words in ${verses.size} verses, expected ${APP_WORD_COUNT} in ${APP_VERSE_COUNT}`,
      );
    }
    return {verses, repaired};
  } finally {
    wbw.close();
    dk.close();
  }
}

/** Verse keys in mushaf order. */
export function verseOrder(keys: Iterable<string>): string[] {
  return [...keys].sort((a, b) => {
    const [sa, aa] = a.split(':').map(Number);
    const [sb, ab] = b.split(':').map(Number);
    return sa - sb || aa - ab;
  });
}
