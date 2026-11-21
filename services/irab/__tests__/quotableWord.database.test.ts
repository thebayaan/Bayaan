/**
 * quotableWord over every Hafs DigitalKhatt slot
 * (data/mushaf/digitalkhatt/digital-khatt-v2.db). What Word Study quotes of
 * a word (an i'rab reference, an Arabic meaning's quote, the rasm Mushaf
 * row) must be the slot's own text with exactly the pause marks, the rub el
 * hizb and the sajdah sign taken out, and nothing else. U+06DC (small high
 * seen) above all stays: it is part of the word, the seen over the sad of
 * 2:245:14 and 7:69:22 and the saktah sign of the other five.
 */
import path from 'path';
import Database from 'better-sqlite3';
import {quotableWord} from '../irabFormat';

const DK_DB = path.join(
  __dirname,
  '../../../data/mushaf/digitalkhatt/digital-khatt-v2.db',
);

/** What a quote leaves out, named one by one (never as a range). */
const LEFT_OUT: ReadonlyMap<number, string> = new Map([
  [0x06d6, 'ARABIC SMALL HIGH LIGATURE SAD WITH LAM WITH ALEF MAKSURA'],
  [0x06d7, 'ARABIC SMALL HIGH LIGATURE QAF WITH LAM WITH ALEF MAKSURA'],
  [0x06d8, 'ARABIC SMALL HIGH MEEM INITIAL FORM'],
  [0x06d9, 'ARABIC SMALL HIGH LAM ALEF'],
  [0x06da, 'ARABIC SMALL HIGH JEEM'],
  [0x06db, 'ARABIC SMALL HIGH THREE DOTS'],
  [0x06de, 'ARABIC START OF RUB EL HIZB'],
  [0x06e9, 'ARABIC PLACE OF SAJDAH'],
]);

const SMALL_HIGH_SEEN = '\u06dc';

/** The slot's text without the marks above, whitespace collapsed. */
function expectedQuote(text: string): string {
  return [...text]
    .filter(ch => !LEFT_OUT.has(ch.codePointAt(0) ?? 0))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

let slots: {location: string; text: string}[] = [];

beforeAll(() => {
  const db = new Database(DK_DB, {readonly: true});
  try {
    slots = db
      .prepare('SELECT location, text FROM words ORDER BY id')
      .all() as {location: string; text: string}[];
  } finally {
    db.close();
  }
});

it('reads every Hafs slot', () => {
  expect(slots).toHaveLength(83668);
});

it('quotes every slot as its own text without the pause marks, the rub el hizb and the sajdah sign', () => {
  const wrong = slots
    .filter(slot => quotableWord(slot.text) !== expectedQuote(slot.text))
    .map(slot => slot.location);
  expect(wrong).toEqual([]);
});

it('keeps the small high seen in all 7 slots that carry it', () => {
  const withSeen = slots.filter(slot => slot.text.includes(SMALL_HIGH_SEEN));
  expect(withSeen.map(slot => slot.location)).toEqual([
    '2:245:14',
    '7:69:22',
    '18:1:11',
    '36:52:6',
    '69:28:4',
    '75:27:2',
    '83:14:2',
  ]);
  for (const slot of withSeen) {
    const quoted = quotableWord(slot.text);
    expect(quoted).toContain(SMALL_HIGH_SEEN);
    // The combining grapheme joiner before it (69:28:4, 75:27:2, 83:14:2)
    // stays with it.
    if (slot.text.includes('\u034f\u06dc')) {
      expect(quoted).toContain('\u034f\u06dc');
    }
  }
});
