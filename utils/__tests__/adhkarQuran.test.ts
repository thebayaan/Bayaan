/**
 * Every mapped adhkar Quran passage must be exactly the Hafs Digital Khatt
 * words its span names: compared on the consonant skeleton (marks, alef and
 * hamza forms dropped, doubled letters collapsed) because the adhkar text is
 * in simple script and DK in Uthmani script.
 */
import path from 'path';
import Database from 'better-sqlite3';
import adhkarData from '@/data/adhkar.json';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import {
  ADHKAR_QURAN_SPANS,
  findQuranPassages,
  getAdhkarQuranPassages,
  joinSpanText,
  spanVerseKeys,
} from '../adhkarQuran';

const DK_HAFS_DB = path.join(
  __dirname,
  '../../data/mushaf/digitalkhatt/digital-khatt-v2.db',
);

const rows: ReadonlyArray<{id: string; arabic: string}> = adhkarData.adhkar;

function loadHafsWords(): Map<string, DKWordInfo[]> {
  const db = new Database(DK_HAFS_DB, {readonly: true});
  try {
    const byVerse = new Map<string, DKWordInfo[]>();
    const stmt = db.prepare<[], {location: string; text: string}>(
      'SELECT location, text FROM words ORDER BY id',
    );
    for (const {location, text} of stmt.iterate()) {
      const [surah, ayah, word] = location.split(':');
      const verseKey = `${surah}:${ayah}`;
      const info: DKWordInfo = {
        text,
        verseKey,
        wordPositionInVerse: Number(word),
      };
      const list = byVerse.get(verseKey);
      if (list) list.push(info);
      else byVerse.set(verseKey, [info]);
    }
    return byVerse;
  } finally {
    db.close();
  }
}

function skeleton(text: string): string {
  return text
    .replace(/وٰ/g, '') // Uthmani waw written for alef (ٱلصَّلَوٰة)
    .replace(/[وي]ٔ/g, '') // hamza written above waw / yaa
    .replace(/[ً-ٰٟۖ-ۭـࣰ-ࣿ]/g, '')
    .replace(/[اأإآٱءئؤى]/g, '')
    .replace(/ة/g, 'ه')
    .replace(/[^ء-ي]/g, '')
    .replace(/(.)\1/g, '$1');
}

const hafsWords = loadHafsWords();
const getWords = (verseKey: string): DKWordInfo[] =>
  hafsWords.get(verseKey) ?? [];

function isMarker(word: DKWordInfo): boolean {
  return word.text.startsWith('۝');
}

describe('ADHKAR_QURAN_SPANS', () => {
  const mapped = Object.entries(ADHKAR_QURAN_SPANS);

  it('maps rows that exist, one span per Quran passage', () => {
    for (const [id] of mapped) {
      const found = rows.find(r => r.id === id);
      expect({id, found: !!found}).toEqual({id, found: true});
      const passages = getAdhkarQuranPassages(id, found?.arabic ?? '');
      expect({id, mapped: passages !== null}).toEqual({id, mapped: true});
    }
  });

  it('maps every quranic dua and every row with a recited ﴿ ﴾ passage', () => {
    // 110 only names surahs (﴿الم﴾ tanzil as-sajdah); it is not a recitation.
    const expected = rows
      .filter(
        r =>
          r.id.startsWith('quranic-') ||
          (r.arabic.includes('﴿') && r.id !== '110'),
      )
      .map(r => r.id)
      .sort();
    expect(mapped.map(([id]) => id).sort()).toEqual(expected);
  });

  it('names real words, and wordTo only for a truly partial end', () => {
    for (const [id, spans] of mapped) {
      for (const span of spans) {
        for (const verseKey of spanVerseKeys(span)) {
          expect({id, verseKey, words: getWords(verseKey).length > 0}).toEqual({
            id,
            verseKey,
            words: true,
          });
        }
        const lastWords = getWords(`${span.surah}:${span.ayahTo}`).filter(
          w => !isMarker(w),
        );
        const lastWord = lastWords[lastWords.length - 1]?.wordPositionInVerse;
        if (span.wordTo !== undefined) {
          expect({id, partialEnd: span.wordTo < (lastWord ?? 0)}).toEqual({
            id,
            partialEnd: true,
          });
        }
        expect(span.wordFrom ?? 1).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('matches the row text of each passage', () => {
    for (const [id, spans] of mapped) {
      const found = rows.find(r => r.id === id);
      const arabic = found?.arabic ?? '';
      const ranges = findQuranPassages(arabic);
      spans.forEach((span, index) => {
        const range = ranges[index];
        const rowText = arabic.slice(range.start, range.end);
        const dkText = joinSpanText(span, getWords);
        expect({id, index, text: skeleton(dkText)}).toEqual({
          id,
          index,
          text: skeleton(rowText),
        });
      });
    }
  });
});

describe('joinSpanText', () => {
  it('keeps the end marker of a whole ayah and drops it on a partial end', () => {
    const whole = joinSpanText({surah: 112, ayahFrom: 1, ayahTo: 1}, getWords);
    expect(whole.endsWith('۝١')).toBe(true);
    const part = joinSpanText(
      {surah: 2, ayahFrom: 286, ayahTo: 286, wordFrom: 13, wordTo: 19},
      getWords,
    );
    expect(part).not.toMatch(/۝/);
    expect(part.split(' ')).toHaveLength(7);
  });

  it('is empty when a verse has no words loaded', () => {
    expect(joinSpanText({surah: 1, ayahFrom: 1, ayahTo: 2}, () => [])).toBe('');
  });
});

describe('findQuranPassages', () => {
  it('ends a ﴿ left open at the closing (( )) mark (row 50)', () => {
    const arabic = rows.find(r => r.id === '50')?.arabic ?? '';
    const [range] = findQuranPassages(arabic);
    expect(arabic.slice(range.end, range.end + 2)).toBe('))');
  });

  it('is the whole text when there is no ﴿', () => {
    const text = 'رَبَّنَا';
    expect(findQuranPassages(text)).toEqual([{start: 0, end: text.length}]);
  });
});
