// @ai-generated
/** verseSnippet on real Digital Khatt Hafs words (marker slots included). */
import path from 'path';
import Database from 'better-sqlite3';
import {layoutWords} from '@/services/mushaf/lineWordSpans';
import {verseSnippet} from '../verseSnippet';

interface Word {
  text: string;
  verseKey: string;
  wordPositionInVerse: number;
}

const db = new Database(
  path.join(__dirname, '../../../data/mushaf/digitalkhatt/digital-khatt-v2.db'),
  {readonly: true},
);
afterAll(() => db.close());

/** A verse's slots as the data service lists them (the marker included). */
function verseWords(verseKey: string): Word[] {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return (
    db
      .prepare(
        'SELECT word, text FROM words WHERE surah = ? AND ayah = ? ORDER BY word',
      )
      .all(surah, ayah) as {word: number; text: string}[]
  ).map(row => ({text: row.text, verseKey, wordPositionInVerse: row.word}));
}

function highlightedText(
  words: readonly Word[],
  ranges: readonly {start: number; end: number}[],
): string[] {
  const text = layoutWords(words).text;
  return ranges.map(r => text.slice(r.start, r.end + 1));
}

describe('verseSnippet', () => {
  it('shows a short verse whole', () => {
    const words = verseWords('1:1');
    const snippet = verseSnippet(words, [3]);
    expect(snippet.words).toEqual(words);
    expect(snippet.cutStart).toBe(false);
    expect(snippet.cutEnd).toBe(false);
    expect(highlightedText(snippet.words, snippet.highlights)).toEqual([
      words[2].text,
    ]);
  });

  it('cuts a long verse to 20 words from 5 before the first match', () => {
    const words = verseWords('2:282');
    expect(words.filter(w => !w.text.startsWith('\u{06DD}'))).toHaveLength(128);
    const snippet = verseSnippet(words, [60, 61]);
    expect(snippet.words).toHaveLength(20);
    expect(snippet.words[0].wordPositionInVerse).toBe(55);
    expect(snippet.cutStart).toBe(true);
    expect(snippet.cutEnd).toBe(true);
    expect(highlightedText(snippet.words, snippet.highlights)).toEqual([
      words[59].text,
      words[60].text,
    ]);
  });

  it('keeps 20 words when the match is near either end', () => {
    const words = verseWords('2:282');
    const start = verseSnippet(words, [2]);
    expect(start.words[0].wordPositionInVerse).toBe(1);
    expect(start.cutStart).toBe(false);
    expect(start.cutEnd).toBe(true);
    const end = verseSnippet(words, [127]);
    expect(end.words).toHaveLength(20);
    expect(end.words[end.words.length - 1]).toBe(words[words.length - 1]);
    expect(end.cutStart).toBe(true);
    expect(end.cutEnd).toBe(false);
  });

  it('gives the layoutWords spans of the matched slots', () => {
    const words = verseWords('2:255');
    const snippet = verseSnippet(words, [1, 3]);
    const spans = layoutWords(snippet.words).spans;
    expect(snippet.highlights).toEqual(
      spans
        .filter(s => [1, 3].includes(s.item.wordPositionInVerse))
        .map(s => ({start: s.start, end: s.wordEnd})),
    );
  });

  it('highlights a slot with a space whole (37:130:3)', () => {
    const words = verseWords('37:130');
    const snippet = verseSnippet(words, [3]);
    expect(highlightedText(snippet.words, snippet.highlights)).toEqual([
      words[2].text,
    ]);
    expect(words[2].text).toContain(' ');
  });

  it('opens at the verse start when nothing matches', () => {
    const snippet = verseSnippet(verseWords('2:282'), []);
    expect(snippet.words[0].wordPositionInVerse).toBe(1);
    expect(snippet.highlights).toEqual([]);
  });
});
