// @ai-generated
import {
  decodePostings,
  encodePostings,
  flagsOfCode,
  hasFlag,
  packPosting,
  QURAN_FLAG,
  QURAN_VERSE_COUNT,
  slotOfCode,
  unpackPosting,
  verseIndexOf,
  verseKeyAt,
  type QuranPosting,
} from '../quranIndexFormat';

describe('posting codes', () => {
  const postings: QuranPosting[] = [
    {verseIndex: 0, position: 1, tier: 3, hasHamza: false, rasmOnly: false},
    {verseIndex: 0, position: 1, tier: 1, hasHamza: true, rasmOnly: true},
    {verseIndex: 261, position: 7, tier: 2, hasHamza: true, rasmOnly: false},
    {verseIndex: 6235, position: 255, tier: 3, hasHamza: true, rasmOnly: true},
  ];

  it.each(postings)('round-trips %j', posting => {
    expect(unpackPosting(packPosting(posting))).toEqual(posting);
  });

  it('packs slot = verseIndex * 256 + position and code = slot * 32 + flags', () => {
    const code = packPosting(postings[2]);
    expect(code).toBe((261 * 256 + 7) * 32 + 2 + 4);
    expect(slotOfCode(code)).toBe(261 * 256 + 7);
    const flags = flagsOfCode(code);
    expect(hasFlag(flags, QURAN_FLAG.hasHamza)).toBe(true);
    expect(hasFlag(flags, QURAN_FLAG.rasmOnly)).toBe(false);
    expect(hasFlag(flags, QURAN_FLAG.otherRewayah)).toBe(false);
  });

  it('stays below 2^26', () => {
    expect(packPosting(postings[3])).toBeLessThan(2 ** 26);
  });

  it.each([
    {verseIndex: -1, position: 1, tier: 3},
    {verseIndex: QURAN_VERSE_COUNT, position: 1, tier: 3},
    {verseIndex: 0, position: 0, tier: 3},
    {verseIndex: 0, position: 256, tier: 3},
    {verseIndex: 0.5, position: 1, tier: 3},
    {verseIndex: 0, position: 1, tier: 0},
  ])('refuses %j', bad => {
    expect(() =>
      packPosting({...bad, hasHamza: false, rasmOnly: false} as QuranPosting),
    ).toThrow(RangeError);
  });
});

describe('postings text', () => {
  it.each([
    [[]],
    [[0]],
    [[42]],
    [[1, 2, 3]],
    [[33, 1_000_000, 51_085_311]],
    [[5, 6, 2 ** 26 - 1]],
  ])('round-trips %j', codes => {
    expect(decodePostings(encodePostings(codes))).toEqual(codes);
  });

  it('stores the first code, then deltas, in base 36', () => {
    // 36 = 10 in base 36; 37 - 36 = 1; 1333 - 37 = 1296 = 36^2.
    expect(encodePostings([36, 37, 1333])).toBe('10,1,100');
    expect(encodePostings([])).toBe('');
  });

  it('refuses unsorted, repeated or invalid codes', () => {
    expect(() => encodePostings([3, 2])).toThrow(RangeError);
    expect(() => encodePostings([3, 3])).toThrow(RangeError);
    expect(() => encodePostings([-1])).toThrow(RangeError);
    expect(() => encodePostings([1.5])).toThrow(RangeError);
  });

  it('refuses malformed text', () => {
    expect(() => decodePostings('1,,2')).toThrow();
    expect(() => decodePostings('1,-2')).toThrow();
    expect(() => decodePostings('ZZ')).toThrow();
  });
});

describe('verse indexes', () => {
  it.each([
    [0, '1:1'],
    [6, '1:7'],
    [7, '2:1'],
    [261, '2:255'],
    [292, '2:286'],
    [293, '3:1'],
    [6235, '114:6'],
  ])('%i is %s', (index, key) => {
    expect(verseKeyAt(index)).toBe(key);
    expect(verseIndexOf(key)).toBe(index);
  });

  it('round-trips every verse in mushaf order', () => {
    for (let i = 0; i < QURAN_VERSE_COUNT; i++) {
      expect(verseIndexOf(verseKeyAt(i))).toBe(i);
    }
  });

  it.each([
    ['115:1'],
    ['1:8'],
    ['0:1'],
    ['2:0'],
    ['02:255'],
    ['2:255:1'],
    ['x'],
  ])('%s has no index', key => {
    expect(verseIndexOf(key)).toBeNull();
  });

  it('refuses an index outside the Quran', () => {
    expect(() => verseKeyAt(-1)).toThrow(RangeError);
    expect(() => verseKeyAt(QURAN_VERSE_COUNT)).toThrow(RangeError);
  });
});
