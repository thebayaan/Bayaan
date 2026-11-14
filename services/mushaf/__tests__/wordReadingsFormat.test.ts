// @ai-generated
/**
 * The per-word readings row decoder against wordReadingsFixture.json: real
 * rows of dk_readings.db next to the readings expected for them, computed
 * by gen_word_readings_fixture.py from the words DBs, diffs and reviewed
 * files (not from the index). Plus every malformed-row variant.
 */
import {ALL_REWAYAH_IDS} from '@/services/rewayah/RewayahIdentity';
import {
  alikeReadings,
  combineReadings,
  decodeReadingsRow,
  dkPositionsForWbwWord,
  findGroup,
  parseReadingsInfo,
  READINGS_FORMAT,
  READINGS_REWAYAT,
  ReadingsFormatError,
  WBW_JOINED_WORDS,
  type WordReadings,
} from '../wordReadingsFormat';

interface FixtureWord {
  verseKey: string;
  position: number;
  wordId: number;
  data: string | null;
  expected: WordReadings;
}

const fixture = require('../__fixtures__/wordReadingsFixture.json') as {
  info: {key: string; value: string}[];
  words: FixtureWord[];
};
const words = fixture.words;
const word = (verseKey: string, position: number): FixtureWord => {
  const found = words.find(
    w => w.verseKey === verseKey && w.position === position,
  );
  if (!found) throw new Error(`${verseKey}:${position} not in the fixture`);
  return found;
};
const decode = (w: FixtureWord): WordReadings => {
  if (w.data === null) throw new Error(`${w.verseKey}:${w.position}: no row`);
  return decodeReadingsRow(w.verseKey, w.position, w.wordId, w.data);
};

describe('format constants', () => {
  it('members are the 8 rewayat with text, in ALL_REWAYAH_IDS order', () => {
    expect(READINGS_REWAYAT).toEqual(ALL_REWAYAH_IDS.slice(0, 8));
  });

  it('parses the info table of the bundled index', () => {
    const info = parseReadingsInfo(fixture.info);
    expect(info.format).toBe(READINGS_FORMAT);
    expect(info.rewayat).toEqual([...READINGS_REWAYAT]);
    expect(Object.keys(info.inputs).sort()).toEqual(
      [
        'digital-khatt-v2.db',
        ...['shouba', 'bazzi', 'qumbul', 'warsh', 'qaloon', 'doori', 'soosi']
          .map(id => [`dk_words_${id}.db`, `${id}-diff.json`])
          .flat(),
      ].sort(),
    );
    for (const sha of Object.values(info.inputs)) {
      expect(sha).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('rejects a malformed info table', () => {
    expect(() => parseReadingsInfo([])).toThrow(ReadingsFormatError);
    expect(() =>
      parseReadingsInfo([
        {key: 'format', value: '1'},
        {key: 'rewayat', value: 'hafs'},
        {key: 'inputs', value: 'not json'},
      ]),
    ).toThrow(ReadingsFormatError);
    expect(() =>
      parseReadingsInfo([
        {key: 'format', value: '1'},
        {key: 'rewayat', value: 'hafs'},
        {key: 'inputs', value: '{"a": 1}'},
      ]),
    ).toThrow(ReadingsFormatError);
  });
});

describe('decodeReadingsRow on the bundled rows', () => {
  const indexed = words.filter(w => w.data !== null);

  it.each(indexed.map(w => [`${w.verseKey}:${w.position}`, w] as const))(
    '%s decodes to the readings computed from the DBs',
    (_label, w) => {
      expect(decode(w)).toEqual(w.expected);
    },
  );

  it('1:4:1: Hafs and Shu`bah, then the other six with al-Susi`s own text', () => {
    const r = decode(word('1:4', 1));
    expect(r.groups.map(g => g.kind)).toEqual(['asHafs', 'differs']);
    expect(r.groups[0].members.map(m => m.rewayah)).toEqual(['hafs', 'shubah']);
    expect(r.groups[1].text).toBe('مَلِكِ');
    const susi = r.groups[1].members.find(m => m.rewayah === 'al-susi');
    // مَّلِكِ as stored: meem, shadda, then fatha (not the canonical mark order)
    expect(susi?.ownText).toBe('مَّلِكِ');
    expect(susi?.category).toBe('mukhtalif');
    expect(r.groups[1].members[0].category).toBe('major'); // al-Bazzi
    expect(r.alike).toBe(false);
    expect(findGroup(r, 'warsh')).toBe(r.groups[1]);
    expect(findGroup(r, 'hafs')).toBe(r.groups[0]);
    expect(findGroup(r, 'hisham')).toBeNull();
  });

  it('a span covers both Hafs slots, from either slot', () => {
    expect(decode(word('40:26', 13)).positions).toEqual([13, 14]);
    expect(decode(word('40:26', 14)).positions).toEqual([13, 14]);
    expect(decode(word('40:26', 14))).toEqual(decode(word('40:26', 13)));
    const joined = decode(word('15:7', 1));
    expect(joined.groups).toHaveLength(1);
    expect(joined.groups[0].members[1].wordCount).toBe(1); // Shu'bah: لَّوْمَا
  });

  it('57:24:10: Warsh and Qalun do not read the word', () => {
    const r = decode(word('57:24', 10));
    expect(r.groups.map(g => [g.kind, g.text])).toEqual([
      ['asHafs', 'هُوَ'],
      ['notRead', ''],
    ]);
    expect(r.groups[1].members.map(m => m.rewayah)).toEqual(['warsh', 'qalun']);
  });

  it('verse ends, silah and the basmala', () => {
    const r = decode(word('1:7', 4));
    expect(r.groups).toHaveLength(1);
    const bazzi = r.groups[0].members[2];
    expect(bazzi.ownText).toBe('عَلَيْهِمُۥ');
    expect(bazzi.silahChars).toEqual([9, 10]);
    expect(r.groups[0].members[4].verseEnd).toBe(6); // Warsh ends verse 6 here
    expect(decode(word('2:1', 1)).groups[0].members[2].verseEnd).toBe(0);
    expect(decode(word('1:1', 1)).basmalaUnnumberedIn).toEqual([
      'warsh',
      'qalun',
      'al-duri-abi-amr',
      'al-susi',
    ]);
  });

  it('a suspected misprint is read with its sibling and marked, never its own reading', () => {
    const r = decode(word('17:62', 1));
    expect(r.groups).toHaveLength(1);
    const qalun = r.groups[0].members.find(m => m.rewayah === 'qalun');
    expect(qalun).toMatchObject({questioned: true, ownText: null});
    expect(r.alike).toBe(true); // nothing the app shows
  });
});

describe('words with no row', () => {
  it('read alike; combineReadings joins the DK slots of a word-by-word word', () => {
    const parts = [word('2:181', 3), word('2:181', 4)];
    for (const p of parts) {
      expect(p.data).toBeNull();
      expect(p.expected.alike).toBe(true);
    }
    const r = combineReadings(
      parts.map(p => alikeReadings(p.verseKey, [p.position])),
    );
    expect(r.positions).toEqual([3, 4]);
    expect(r.alike).toBe(true);
    expect(r.hafsText).toBeNull();
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].members.map(m => m.rewayah)).toEqual([
      ...READINGS_REWAYAT,
    ]);
  });

  it('combines identical span rows and refuses to pair two different words', () => {
    const a = decode(word('40:26', 13));
    const b = decode(word('40:26', 14));
    expect(combineReadings([a, b])).toEqual(a);
    expect(() =>
      combineReadings([decode(word('1:4', 1)), decode(word('2:9', 6))]),
    ).toThrow(ReadingsFormatError);
    expect(() =>
      combineReadings([alikeReadings('2:181', [3]), decode(word('2:9', 6))]),
    ).toThrow(ReadingsFormatError);
    expect(() => combineReadings([])).toThrow(ReadingsFormatError);
  });

  it('maps word-by-word positions to DK positions', () => {
    expect(WBW_JOINED_WORDS).toEqual({'2:181': 3, '8:6': 4, '13:37': 8});
    expect(dkPositionsForWbwWord('2:181', 2)).toEqual([2]);
    expect(dkPositionsForWbwWord('2:181', 3)).toEqual([3, 4]);
    expect(dkPositionsForWbwWord('2:181', 4)).toEqual([5]);
    expect(dkPositionsForWbwWord('2:181', 11)).toEqual([12]);
    expect(dkPositionsForWbwWord('13:37', 8)).toEqual([8, 9]);
    expect(dkPositionsForWbwWord('1:4', 1)).toEqual([1]);
  });
});

describe('malformed rows', () => {
  const base = word('1:4', 1);
  const row = () => JSON.parse(base.data as string);
  const variant = (edit: (r: Record<string, unknown>) => void): string => {
    const r = row();
    edit(r);
    return JSON.stringify(r);
  };
  const reject = (data: string, verseKey = '1:4', position = 1, wordId = 14) =>
    expect(() => decodeReadingsRow(verseKey, position, wordId, data)).toThrow(
      ReadingsFormatError,
    );

  it('decodes the unedited row (the variants below are the only change)', () => {
    expect(() =>
      decodeReadingsRow('1:4', 1, base.wordId, base.data as string),
    ).not.toThrow();
    expect(base.wordId).toBe(14);
  });

  it.each<[string, (r: Record<string, unknown>) => void]>([
    ['an unknown key', r => (r.z = 1)],
    ['no texts', r => (r.t = [])],
    ['a text that is not a string', r => ((r.t as unknown[])[1] = 3)],
    ['duplicate texts', r => ((r.t as string[])[2] = (r.t as string[])[1])],
    ['no groups', r => (r.g = [])],
    ['an unknown kind', r => ((r.g as unknown[][])[1][0] = 'x')],
    ['a text index out of range', r => ((r.g as unknown[][])[1][1] = 9)],
    [
      'a duplicate member',
      r => ((r.g as unknown[][])[1][2] = [0, 2, 3, 4, 5, 6, 7]),
    ],
    ['a missing member', r => ((r.g as unknown[][])[1][2] = [2, 3, 4, 5, 6])],
    [
      'a member index out of range',
      r => ((r.g as unknown[][])[1][2] = [2, 3, 4, 5, 6, 7, 8]),
    ],
    [
      'an unsorted member list',
      r => ((r.g as unknown[][])[1][2] = [3, 2, 4, 5, 6, 7]),
    ],
    [
      'a first group that is not Hafs`s',
      r => (r.g = [(r.g as unknown[])[1], (r.g as unknown[])[0]]),
    ],
    [
      'Hafs outside the first group',
      r =>
        (r.g = [
          ['h', 0, [1]],
          ['d', 1, [0, 2, 3, 4, 5, 6, 7]],
        ]),
    ],
    ['a not-read group with text', r => ((r.g as unknown[][])[1][0] = 'o')],
    ['a member detail for Hafs', r => (r.m = {'0': {v: 1}})],
    ['a bad member key', r => (r.m = {'07': {v: 1}})],
    ['an empty member detail', r => (r.m = {'7': {}})],
    ['an unknown member detail', r => (r.m = {'7': {x: 2, y: 1}})],
    ['an own text out of range', r => (r.m = {'7': {x: 5}})],
    ['an unused text', r => (r.m = {})],
    ['silah without an own text', r => (r.m = {'7': {x: 2}, '6': {s: [1]}})],
    ['a silah index out of range', r => (r.m = {'7': {x: 2, s: [40]}})],
    ['a silah index off the silah mark', r => (r.m = {'7': {x: 2, s: [0]}})],
    ['a word count on a differing member', r => (r.m = {'7': {x: 2, w: 2}})],
    ['a negative verse number', r => (r.m = {'7': {x: 2, v: -1}})],
    ['q other than 1', r => (r.m = {'7': {x: 2}, '6': {q: 2}})],
    ['q with an own text', r => (r.m = {'7': {x: 2, q: 1}})],
    ['a malformed span', r => (r.span = [14])],
    ['a span not holding the word', r => (r.span = [20, 21])],
    ['a basmala list outside 1:1', r => (r.u = [4])],
  ])('rejects %s', (_label, edit) => {
    reject(variant(edit));
  });

  it('rejects text that is not JSON, or not an object', () => {
    reject('{');
    reject('[]');
    reject('null');
  });

  it('rejects own text without silah in the Hafs group', () => {
    const r = decode(word('1:7', 4));
    expect(r.groups).toHaveLength(1);
    const data = JSON.parse(word('1:7', 4).data as string);
    delete data.m['2'].s;
    reject(JSON.stringify(data), '1:7', 4, word('1:7', 4).wordId);
  });

  it('reports another format version as it is, for the service to refuse', () => {
    const info = parseReadingsInfo([
      {key: 'format', value: '2'},
      {key: 'rewayat', value: READINGS_REWAYAT.join(',')},
      {key: 'inputs', value: '{}'},
    ]);
    expect(info.format).not.toBe(READINGS_FORMAT);
  });
});
