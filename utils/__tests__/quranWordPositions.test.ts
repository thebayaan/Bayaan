// @ai-generated
import path from 'path';
import Database from 'better-sqlite3';
import {
  DK_SPLIT_SLOTS,
  dkToQulPosition,
  qulToDkPositions,
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
