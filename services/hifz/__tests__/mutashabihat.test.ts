import type {PairResult} from '@/store/hifzStore';
import {
  drillKey,
  findDrill,
  lookAlikesFor,
  missedDrills,
} from '../mutashabihat';

const MEMORIZED = new Set([7, 26, 20]);

function result(overrides: Partial<PairResult>): PairResult {
  return {lastAt: 0, clean: 0, missed: 1, lastMissed: true, ...overrides};
}

describe('lookAlikesFor', () => {
  it('keeps look-alikes only when both ayat are memorised', () => {
    expect(
      lookAlikesFor(
        '7:111',
        [
          {matchedVerseKey: '26:36', score: 86},
          {matchedVerseKey: '2:40', score: 90},
        ],
        MEMORIZED,
      ),
    ).toEqual([{ayah: '7:111', other: '26:36', score: 86}]);
  });

  it('leaves out weak look-alikes and the ayah itself', () => {
    expect(
      lookAlikesFor(
        '7:111',
        [
          {matchedVerseKey: '26:37', score: 60},
          {matchedVerseKey: '7:111', score: 100},
        ],
        MEMORIZED,
      ),
    ).toEqual([]);
  });
});

describe('missedDrills', () => {
  it('missed pairs come back first, the longest waiting first', () => {
    const results: Record<string, PairResult> = {
      [drillKey('7:111', '26:36')]: result({lastAt: 100}),
      [drillKey('20:9', '7:10')]: result({lastAt: 50}),
      [drillKey('26:36', '7:111')]: result({lastAt: 10, lastMissed: false}),
    };
    expect(missedDrills(results, MEMORIZED)).toEqual([
      {ayah: '20:9', other: '7:10'},
      {ayah: '7:111', other: '26:36'},
    ]);
  });

  it('skips missed pairs outside the memorised surahs', () => {
    const results = {[drillKey('2:40', '7:111')]: result({})};
    expect(missedDrills(results, MEMORIZED)).toEqual([]);
  });
});

describe('findDrill', () => {
  const similarOf = jest.fn(async (key: string) =>
    key === '26:36' ? [{matchedVerseKey: '7:111', score: 86}] : [],
  );
  const keysOfSurah = (surah: number) =>
    ({7: ['7:110', '7:111'], 26: ['26:35', '26:36'], 20: ['20:9']})[surah] ??
    [];

  it('a missed pair is drilled before looking for a new one', async () => {
    const drill = await findDrill(
      [...MEMORIZED],
      {[drillKey('20:9', '7:10')]: result({})},
      () => 0,
      similarOf,
      keysOfSurah,
    );
    expect(drill).toEqual({ayah: '20:9', other: '7:10'});
  });

  it('otherwise finds a memorised ayah with a strong look-alike', async () => {
    let i = 0;
    const order = [0.99, 0.6, 0.3];
    const drill = await findDrill(
      [...MEMORIZED],
      {},
      () => order[i++ % order.length],
      similarOf,
      keysOfSurah,
    );
    expect(drill).toEqual({ayah: '26:36', other: '7:111'});
  });

  it('gives up when nothing memorised has a look-alike', async () => {
    const drill = await findDrill(
      [20],
      {},
      () => 0,
      async () => [],
      keysOfSurah,
    );
    expect(drill).toBeNull();
  });
});
