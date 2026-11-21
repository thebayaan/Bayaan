// @ai-generated
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {
  DK_SPLIT_SLOTS,
  dkToQpcTajweedPositions,
  dkToQulPosition,
  qulToDkPositions,
  slotTajweedSegments,
  type QpcTajweedWord,
} from '../quranWordPositions';

describe('DK slot <-> QUL word position', () => {
  it('maps both slots of «بعد ما» to one QUL word (2:181)', () => {
    expect([1, 2, 3, 4, 5, 6].map(p => dkToQulPosition('2:181', p))).toEqual([
      1, 2, 3, 3, 4, 5,
    ]);
    expect(qulToDkPositions('2:181', 2)).toEqual([2]);
    expect(qulToDkPositions('2:181', 3)).toEqual([3, 4]);
    expect(qulToDkPositions('2:181', 4)).toEqual([5]);
  });

  it.each([
    ['8:6', 4, 5],
    ['13:37', 8, 9],
  ])('maps %s slots %i-%i to one word', (verseKey, first, second) => {
    expect(dkToQulPosition(verseKey, first)).toBe(first);
    expect(dkToQulPosition(verseKey, second)).toBe(first);
    expect(dkToQulPosition(verseKey, second + 1)).toBe(second);
    expect(qulToDkPositions(verseKey, first)).toEqual([first, second]);
    expect(qulToDkPositions(verseKey, first - 1)).toEqual([first - 1]);
    expect(qulToDkPositions(verseKey, second)).toEqual([second + 1]);
  });

  it('is the identity everywhere else', () => {
    for (const [verseKey, position] of [
      ['1:1', 3],
      ['2:282', 128],
      ['18:10', 1],
    ] as const) {
      expect(dkToQulPosition(verseKey, position)).toBe(position);
      expect(qulToDkPositions(verseKey, position)).toEqual([position]);
    }
  });

  it('matches the bundled DBs: word counts differ only in the split verses', () => {
    const root = path.join(__dirname, '../..');
    const dk = new Database(
      path.join(root, 'data/mushaf/digitalkhatt/digital-khatt-v2.db'),
      {readonly: true},
    );
    const qul = new Database(path.join(root, 'data/wbw/wbw-en.db'), {
      readonly: true,
    });
    const count = (db: Database.Database, sql: string) =>
      new Map(
        (db.prepare(sql).all() as {verse_key: string; n: number}[]).map(r => [
          r.verse_key,
          r.n,
        ]),
      );
    const dkCounts = count(
      dk,
      "SELECT surah || ':' || ayah AS verse_key, COUNT(*) AS n FROM words WHERE text NOT LIKE '۝%' GROUP BY surah, ayah",
    );
    const qulCounts = count(
      qul,
      'SELECT verse_key, COUNT(*) AS n FROM words GROUP BY verse_key',
    );
    const differ = [...dkCounts]
      .filter(([key, n]) => qulCounts.get(key) !== n)
      .map(([key, n]) => [key, n - (qulCounts.get(key) ?? 0)]);
    expect(dkCounts.size).toBe(6236);
    expect(qulCounts.size).toBe(6236);
    expect(Object.fromEntries(differ)).toEqual({
      '2:181': 1,
      '8:6': 1,
      '13:37': 1,
    });
    // The extra slot is «ما» right after «بعد».
    const word = dk.prepare('SELECT text FROM words WHERE location = ?');
    const textAt = (verseKey: string, slot: number) =>
      (word.get(`${verseKey}:${slot}`) as {text: string}).text;
    for (const [verseKey, slot] of Object.entries(DK_SPLIT_SLOTS)) {
      expect(textAt(verseKey, slot - 1).startsWith('بَعْد')).toBe(true);
      expect(textAt(verseKey, slot).startsWith('مَا')).toBe(true);
    }
    dk.close();
    qul.close();
  });
});

// QPC 37:130 as data/QPC Hafs Tajweed 2.json has it (words 3 and 4).
const IL = {location: '37:130:3', segments: [{text: 'إِلۡ', rule: null}]};
const YASIN = {
  location: '37:130:4',
  segments: [
    {text: 'يَاس', rule: null},
    {text: 'ِي', rule: 'madda_permissible'},
    {text: 'نَ', rule: null},
  ],
};
const VERSE_37_130: QpcTajweedWord[] = [
  {location: '37:130:1', segments: [{text: 'سَلَـٰمٌ', rule: null}]},
  {location: '37:130:2', segments: [{text: 'عَلَىٰٓ', rule: null}]},
  IL,
  YASIN,
];

describe('DK slot <-> QPC tajweed words', () => {
  it('gives «إِلْ يَاسِينَ» (37:130 slot 3) QPC words 3 and 4, the end marker none', () => {
    expect(dkToQpcTajweedPositions('37:130', 2)).toEqual([2]);
    expect(dkToQpcTajweedPositions('37:130', 3)).toEqual([3, 4]);
    expect(dkToQpcTajweedPositions('37:130', 4)).toEqual([]);
  });

  it('is the identity everywhere else, «بعد ما» included', () => {
    expect(dkToQpcTajweedPositions('1:1', 5)).toEqual([5]);
    expect(dkToQpcTajweedPositions('2:181', 3)).toEqual([3]);
    expect(dkToQpcTajweedPositions('2:181', 4)).toEqual([4]);
  });

  it('joins the segments of a two-word slot with a space, as the slot writes it', () => {
    expect(slotTajweedSegments(VERSE_37_130, 3)).toEqual([
      ...IL.segments,
      {text: ' ', rule: null},
      ...YASIN.segments,
    ]);
    expect(slotTajweedSegments(VERSE_37_130, 4)).toBeNull();
  });

  it('gives any other slot its own word, and null when QPC has none', () => {
    expect(slotTajweedSegments(VERSE_37_130, 2)).toBe(VERSE_37_130[1].segments);
    expect(slotTajweedSegments([IL], 2)).toBeNull();
    expect(slotTajweedSegments([], 1)).toBeNull();
  });

  it('matches the bundled data: every DK slot spells its QPC tajweed words', () => {
    const root = path.join(__dirname, '../..');
    const qpc = JSON.parse(
      fs.readFileSync(path.join(root, 'data/QPC Hafs Tajweed 2.json'), 'utf8'),
    ) as Record<string, {location: string; text: string}>;
    const qpcText = new Map(
      Object.values(qpc).map(w => [w.location, w.text.replace(/<[^>]*>/g, '')]),
    );
    const dk = new Database(
      path.join(root, 'data/mushaf/digitalkhatt/digital-khatt-v2.db'),
      {readonly: true},
    );
    const slots = dk
      .prepare('SELECT surah, ayah, word, text FROM words ORDER BY id')
      .all() as {surah: number; ayah: number; word: number; text: string}[];
    dk.close();
    expect(slots.length).toBeGreaterThan(80_000);

    // Letters only, folding what the two files spell differently: آ أ إ ٱ
    // to ا, ؤ to و, and every ya or alef maqsura form dropped (QPC writes
    // final ي as ى, and ىٰ as ٮٰ or ـٰ).
    const skeleton = (text: string) =>
      text
        .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
        .replace(/\u0624/g, '\u0648')
        .replace(/[\u0626\u064A\u0649\u066E]/g, '')
        .replace(/[^\u0621-\u063A\u0641-\u064A ]/g, '')
        .trim();
    // An end marker's QPC word, if any, is a verse number or ۩ (no rule).
    const MARKER_WORD = /^[\u0660-\u0669\u06E9]+$/;

    const unspelled = (
      wordsOf: (verseKey: string, slot: number) => readonly number[],
    ) =>
      slots
        .filter(({surah, ayah, word, text}) => {
          const verseKey = `${surah}:${ayah}`;
          const positions = wordsOf(verseKey, word);
          const words = positions.flatMap(
            p => qpcText.get(`${verseKey}:${p}`) ?? [],
          );
          if (words.length !== positions.length) return true;
          return text.startsWith('۝')
            ? words.some(w => !MARKER_WORD.test(w))
            : skeleton(words.join(' ')) !== skeleton(text);
        })
        .map(({surah, ayah, word}) => `${surah}:${ayah}:${word}`);

    // By position alone, only «إِلْ يَاسِينَ» and the end marker after it
    // miss their words; through the table, no slot does.
    expect(unspelled((_verseKey, slot) => [slot])).toEqual([
      '37:130:3',
      '37:130:4',
    ]);
    expect(unspelled(dkToQpcTajweedPositions)).toEqual([]);
  });
});
