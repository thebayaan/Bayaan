// @ai-generated
import type {RangePickerNumbering} from '@/utils/playbackRangePicker';
import {
  advanceKey,
  countVerses,
  detectPreset,
  extendRange,
  isKeyInRange,
  juzRange,
  orderedRange,
  pageRange,
  parseRangeQuery,
  presetRange,
  surahRange,
  type RangeEnv,
} from '@/utils/playbackRangeSelection';

const HAFS: RangePickerNumbering = {
  rewayah: 'hafs',
  units: null,
  hafsFallback: false,
};

function keys(surah: number, from: number, to: number): string[] {
  return Array.from({length: to - from + 1}, (_, i) => `${surah}:${from + i}`);
}

// A few pages of the Madani layout.
const PAGES: Record<number, string[]> = {
  1: keys(1, 1, 7),
  2: keys(2, 1, 5),
  3: keys(2, 6, 16),
  21: keys(2, 137, 141),
  22: keys(2, 142, 145),
  41: keys(2, 246, 252),
  42: keys(2, 253, 256),
  582: keys(78, 1, 30),
  604: [...keys(112, 1, 4), ...keys(113, 1, 5), ...keys(114, 1, 6)],
};

const env: RangeEnv = {
  numbering: HAFS,
  hafsKeysOfPage: page => PAGES[page] ?? [],
  pageOfHafsKey: key => {
    for (const [page, list] of Object.entries(PAGES)) {
      if (list.includes(key)) return Number(page);
    }
    return undefined;
  },
};
const n = env.numbering;

describe('playbackRangeSelection', () => {
  it('orders and tests ranges', () => {
    expect(orderedRange('2:20', '2:6')).toEqual({start: '2:6', end: '2:20'});
    expect(orderedRange('3:1', '2:286')).toEqual({start: '2:286', end: '3:1'});
    expect(isKeyInRange('2:10', {start: '2:6', end: '2:20'})).toBe(true);
    expect(isKeyInRange('3:1', {start: '2:6', end: '2:20'})).toBe(false);
  });

  it('counts verses across surahs', () => {
    expect(countVerses(n, {start: '2:6', end: '2:20'})).toBe(15);
    expect(countVerses(n, {start: '1:7', end: '2:2'})).toBe(3);
    expect(countVerses(n, {start: '1:1', end: '3:1'})).toBe(7 + 286 + 1);
  });

  it('advances across a surah end and stops at the last verse', () => {
    expect(advanceKey(n, '2:1', 5)).toBe('2:6');
    expect(advanceKey(n, '1:5', 5)).toBe('2:3');
    expect(advanceKey(n, '114:4', 5)).toBe('114:6');
  });

  it('builds page, surah and juz ranges', () => {
    expect(pageRange(env, 2)).toEqual({start: '2:1', end: '2:5'});
    expect(surahRange(n, 67)).toEqual({start: '67:1', end: '67:30'});
    expect(juzRange(env, 1)).toEqual({start: '1:1', end: '2:141'});
    expect(juzRange(env, 30)).toEqual({start: '78:1', end: '114:6'});
    expect(presetRange(env, 'juz', 2, '2:1')).toEqual({
      start: '1:1',
      end: '2:141',
    });
  });

  it('detects the preset a range matches', () => {
    expect(detectPreset(env, {start: '2:1', end: '2:5'}, 2)).toBe('page');
    expect(detectPreset(env, {start: '2:1', end: '2:286'}, 2)).toBe('surah');
    expect(detectPreset(env, {start: '1:1', end: '2:141'}, 2)).toBe('juz');
    expect(detectPreset(env, {start: '2:6', end: '2:20'}, 2)).toBe('custom');
  });

  it('extends the end, never shrinks it', () => {
    const range = {start: '2:6', end: '2:8'};
    expect(extendRange(env, range, 'plus5').end).toBe('2:13');
    expect(extendRange(env, range, 'page').end).toBe('2:16');
    expect(extendRange(env, range, 'surah').end).toBe('2:286');
    expect(extendRange(env, range, 'juz').end).toBe('2:141');
    const atEnd = {start: '2:6', end: '2:16'};
    expect(extendRange(env, atEnd, 'page')).toBe(atEnd);
  });

  describe('parseRangeQuery', () => {
    it('reads verse references', () => {
      expect(parseRangeQuery(env, '2:255')[0]).toEqual({
        kind: 'verse',
        range: {start: '2:255', end: '2:255'},
      });
      const kinds = parseRangeQuery(env, '2:255').map(s => s.kind);
      expect(kinds).toEqual(['verse', 'toEndOfSurah', 'page']);
      expect(parseRangeQuery(env, '2:255-257')[0]).toEqual({
        kind: 'range',
        range: {start: '2:255', end: '2:257'},
      });
      expect(parseRangeQuery(env, '٢:٢٥٥ – ٢٥٧')[0].range).toEqual({
        start: '2:255',
        end: '2:257',
      });
      expect(parseRangeQuery(env, '2:280-3:5')[0].range).toEqual({
        start: '2:280',
        end: '3:5',
      });
    });

    it('rejects verses that do not exist', () => {
      expect(parseRangeQuery(env, '1:8')).toEqual([]);
      expect(parseRangeQuery(env, '115:1')).toEqual([]);
    });

    it('reads pages, juz and named verses', () => {
      expect(parseRangeQuery(env, 'page 42')[0]).toEqual({
        kind: 'page',
        range: {start: '2:253', end: '2:256'},
        number: 42,
      });
      expect(parseRangeQuery(env, 'juz 30')[0].range).toEqual({
        start: '78:1',
        end: '114:6',
      });
      expect(parseRangeQuery(env, 'amma')[0].kind).toBe('juz');
      expect(parseRangeQuery(env, 'kursi')[0].range).toEqual({
        start: '2:255',
        end: '2:255',
      });
    });

    it('reads surah numbers and names with verses', () => {
      expect(parseRangeQuery(env, '18')[0]).toEqual({
        kind: 'surah',
        range: {start: '18:1', end: '18:110'},
      });
      expect(parseRangeQuery(env, 'mulk 1-10')[0]).toEqual({
        kind: 'range',
        range: {start: '67:1', end: '67:10'},
      });
      expect(parseRangeQuery(env, 'mulk')[0].range).toEqual({
        start: '67:1',
        end: '67:30',
      });
    });
  });
});
