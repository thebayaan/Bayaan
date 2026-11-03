import type {TakeRecord} from '@/services/recitation/take';
import {pageVisits} from '../pageProgress';

const pageOf = (key: string) => (key.startsWith('18:') ? 293 : 1);

function take(overrides: Partial<TakeRecord>): TakeRecord {
  return {
    id: 't',
    purpose: 'follow',
    startedAt: 1000,
    endedAt: 2000,
    hidden: true,
    expected: null,
    stopReason: 'user',
    ayat: [{surah: 18, ayah: 1, confidence: 0.9}],
    flags: [],
    peeks: [],
    stalls: [],
    ...overrides,
  };
}

describe('pageVisits', () => {
  it('a hidden take with nothing to check is a clean visit to each page it covered', () => {
    expect(pageVisits([take({})], new Set(), pageOf)).toEqual(
      new Map([[293, [{at: 1000, clean: true}]]]),
    );
  });

  it('a shown flag or a peek on the page makes the visit not clean', () => {
    const flagged = take({
      flags: [
        {
          kind: 'possible_omission',
          surah: 18,
          ayah: 1,
          word: 2,
          source: 'word',
        },
      ],
    });
    const peeked = take({
      startedAt: 5000,
      peeks: [{surah: 18, ayah: 1, kind: 'word', at: 5100}],
    });
    expect(pageVisits([flagged, peeked], new Set(), pageOf).get(293)).toEqual([
      {at: 1000, clean: false},
      {at: 5000, clean: false},
    ]);
  });

  it('dismissed and never-shown flags keep the visit clean', () => {
    const flagged = take({
      flags: [
        {
          kind: 'possible_omission',
          surah: 18,
          ayah: 1,
          word: 2,
          source: 'word',
        },
        {kind: 'possible_vowel', surah: 18, ayah: 1, word: 3, source: 'word'},
      ],
    });
    expect(
      pageVisits([flagged], new Set(['skippedWord:18:1:2']), pageOf).get(293),
    ).toEqual([{at: 1000, clean: true}]);
  });

  it('takes with the text showing do not count as revision', () => {
    expect(pageVisits([take({hidden: false})], new Set(), pageOf).size).toBe(0);
  });

  it('practice takes count', () => {
    expect(
      pageVisits(
        [take({purpose: 'practice', hidden: false})],
        new Set(),
        pageOf,
      ).size,
    ).toBe(1);
  });
});
