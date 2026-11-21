/**
 * WBWDataService over the bundled data/wbw/wbw-en.db, read as the app reads
 * it (imported from the asset, then one query per verse). Four of its
 * transliterations hold U+FFFD where a letter was lost when the file was
 * fetched; no word the service returns may show one.
 */
import path from 'path';
import Database from 'better-sqlite3';
import {registerAssetFile} from '@/test-utils/mockExpoSqlite';
import {
  WBW_TRANSLITERATION_FIXES,
  wbwDataService,
  type WBWWord,
} from '../WBWDataService';

jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

jest.setTimeout(60_000);

const WBW_DB = path.join(__dirname, '../../../data/wbw/wbw-en.db');
const DAMAGED = '\uFFFD';

interface Row {
  verse_key: string;
  position: number;
  text_uthmani: string;
  transliteration: string;
  translation: string;
}

let rows: Row[] = [];
/** Every word the service returns, keyed 's:a:w'. */
const shown = new Map<string, WBWWord>();

beforeAll(async () => {
  const db = new Database(WBW_DB, {readonly: true});
  try {
    rows = db
      .prepare(
        'SELECT verse_key, position, text_uthmani, transliteration, translation FROM words',
      )
      .all() as Row[];
  } finally {
    db.close();
  }
  // The id require() gives the asset in this test run, as in the service.
  registerAssetFile(require('../../../data/wbw/wbw-en.db'), WBW_DB);
  await wbwDataService.initialize();
  const verses = [...new Set(rows.map(row => row.verse_key))];
  for (const verseKey of verses) {
    for (const word of await wbwDataService.getVerseWords(verseKey)) {
      shown.set(`${verseKey}:${word.position}`, word);
    }
  }
});

const keyOf = (row: Row) => `${row.verse_key}:${row.position}`;

describe('WBWDataService over the bundled wbw-en.db', () => {
  it('returns every word of every verse', () => {
    expect(new Set(rows.map(row => row.verse_key)).size).toBe(6236);
    expect(shown.size).toBe(rows.length);
  });

  it('never returns a transliteration or meaning holding U+FFFD', () => {
    const damaged = [...shown]
      .filter(
        ([, word]) =>
          word.transliteration.includes(DAMAGED) ||
          word.translation.includes(DAMAGED),
      )
      .map(([key]) => key);
    expect(damaged).toEqual([]);
  });

  it('gives the damaged words the spelling the file uses for the same word', () => {
    expect(shown.get('2:57:10')?.transliteration).toBe('ṭayyibāti');
    expect(shown.get('5:2:20')?.transliteration).toBe('faḍlan');
    expect(shown.get('24:18:6')?.transliteration).toBe('ʿalīmun');
  });

  it('hides the damaged transliteration that has no such twin (10:88:14)', () => {
    expect(shown.get('10:88:14')?.transliteration).toBe('');
    // Its meaning is whole and still shown.
    expect(shown.get('10:88:14')?.translation).toBe(
      'That they may lead astray',
    );
    const hidden = [...shown]
      .filter(([, word]) => word.transliteration === '')
      .map(([key]) => key);
    expect(hidden).toEqual(['10:88:14']);
  });

  it('replaces only damaged transliterations, each with the spelling of its twins', () => {
    const byKey = new Map(rows.map(row => [keyOf(row), row]));
    for (const [key, spelling] of Object.entries(WBW_TRANSLITERATION_FIXES)) {
      const row = byKey.get(key);
      expect([key, row?.transliteration.includes(DAMAGED)]).toEqual([
        key,
        true,
      ]);
      // Every other word of the file with the same Arabic text.
      const twins = rows.filter(
        other =>
          other.text_uthmani === row?.text_uthmani && keyOf(other) !== key,
      );
      expect(twins.length).toBeGreaterThan(0);
      expect([key, [...new Set(twins.map(t => t.transliteration))]]).toEqual([
        key,
        [spelling],
      ]);
    }
  });

  it('keeps every other transliteration and meaning as the file has it', () => {
    const changed = rows
      .filter(row => {
        const word = shown.get(keyOf(row));
        return (
          word?.translation !== row.translation ||
          (word?.transliteration !== row.transliteration &&
            !row.transliteration.includes(DAMAGED))
        );
      })
      .map(keyOf);
    expect(changed).toEqual([]);
  });
});
