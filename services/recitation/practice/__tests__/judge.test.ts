import type {TakeRecord} from '../../take';
import {judgePractice} from '../judge';
import type {PracticeTarget} from '../types';

function take(overrides: Partial<TakeRecord>): TakeRecord {
  return {
    id: 't',
    purpose: 'practice',
    startedAt: 0,
    endedAt: 1,
    hidden: true,
    expected: null,
    stopReason: 'completed',
    ayat: [],
    flags: [],
    peeks: [],
    stalls: [],
    ...overrides,
  };
}

const ONE_AYAH: PracticeTarget = {
  expected: {surah: 18, ayah: 5, ayahEnd: 5},
  mode: 'correction',
};

describe('judgePractice', () => {
  it('all expected ayat and no flags is clean', () => {
    const verdict = judgePractice(
      ONE_AYAH,
      take({ayat: [{surah: 18, ayah: 5, confidence: 0.9}]}),
      new Set(),
    );
    expect(verdict.outcome).toBe('clean');
  });

  it('a skipped word is flagged', () => {
    const verdict = judgePractice(
      ONE_AYAH,
      take({
        ayat: [{surah: 18, ayah: 5, confidence: 0.9}],
        flags: [
          {
            kind: 'possible_omission',
            surah: 18,
            ayah: 5,
            word: 2,
            source: 'word',
          },
        ],
      }),
      new Set(),
    );
    expect(verdict.outcome).toBe('flagged');
    expect(verdict.flags.map(f => f.key)).toEqual(['skippedWord:18:5:2']);
  });

  it('a dismissed flag does not count', () => {
    const verdict = judgePractice(
      ONE_AYAH,
      take({
        ayat: [{surah: 18, ayah: 5, confidence: 0.9}],
        flags: [
          {
            kind: 'possible_omission',
            surah: 18,
            ayah: 5,
            word: 2,
            source: 'word',
          },
        ],
      }),
      new Set(['skippedWord:18:5:2']),
    );
    expect(verdict.outcome).toBe('clean');
  });

  it('stopping before the end of the passage is partial', () => {
    const verdict = judgePractice(
      {expected: {surah: 18, ayah: 5, ayahEnd: 7}, mode: 'correction'},
      take({ayat: [{surah: 18, ayah: 5, confidence: 0.9}]}),
      new Set(),
    );
    expect(verdict.outcome).toBe('partial');
  });

  it('an ayah the target does not accept is other', () => {
    const verdict = judgePractice(
      {expected: null, mode: 'tracking', accept: ['36:1', '36:2']},
      take({ayat: [{surah: 18, ayah: 1, confidence: 0.9}]}),
      new Set(),
    );
    expect(verdict.outcome).toBe('other');
  });

  it('an accepted ayah in a tracking target is clean', () => {
    const verdict = judgePractice(
      {expected: null, mode: 'tracking', accept: ['36:1', '36:2']},
      take({ayat: [{surah: 36, ayah: 2, confidence: 0.9}]}),
      new Set(),
    );
    expect(verdict.outcome).toBe('clean');
  });

  it('nothing placed is nothing', () => {
    expect(judgePractice(ONE_AYAH, take({}), new Set()).outcome).toBe(
      'nothing',
    );
  });
});
