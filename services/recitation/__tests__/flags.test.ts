import {flagKey, shownFlags, toShownFlag} from '../flags';
import type {TakeFlag} from '../take';

function flag(overrides: Partial<TakeFlag>): TakeFlag {
  return {
    kind: 'possible_omission',
    surah: 18,
    ayah: 22,
    word: 4,
    source: 'word',
    ...overrides,
  };
}

describe('toShownFlag', () => {
  it('vowel, unclear and repetition flags are never shown', () => {
    expect(toShownFlag(flag({kind: 'possible_vowel'}))).toBeNull();
    expect(toShownFlag(flag({kind: 'unclear_ayah'}))).toBeNull();
    expect(toShownFlag(flag({kind: 'possible_repetition'}))).toBeNull();
  });

  it('maps each shown kind, keying ayah-level ones on the ayah', () => {
    expect(toShownFlag(flag({kind: 'possible_omission'}))).toEqual({
      kind: 'skippedWord',
      surah: 18,
      ayah: 22,
      word: 4,
      key: 'skippedWord:18:22:4',
    });
    expect(
      toShownFlag(flag({kind: 'possible_substitution', source: 'word'})),
    ).toMatchObject({kind: 'differentWord', word: 4});
    expect(
      toShownFlag(
        flag({kind: 'possible_substitution', source: 'similar_verse'}),
      ),
    ).toEqual({
      kind: 'similarAyah',
      surah: 18,
      ayah: 22,
      word: 0,
      key: 'similarAyah:18:22:0',
    });
    expect(
      toShownFlag(
        flag({kind: 'possible_skipped_ayah', word: 3, source: 'ayah_order'}),
      ),
    ).toEqual({
      kind: 'skippedAyah',
      surah: 18,
      ayah: 22,
      word: 0,
      key: 'skippedAyah:18:22:0',
    });
  });
});

describe('shownFlags', () => {
  it('dismissed flags stay hidden', () => {
    const flags = [flag({word: 4}), flag({word: 6})];
    expect(
      shownFlags(flags, new Set(['skippedWord:18:22:4'])).map(f => f.key),
    ).toEqual(['skippedWord:18:22:6']);
  });

  it('dedupes and sorts by position', () => {
    const flags = [
      flag({ayah: 30, word: 1}),
      flag({ayah: 22, word: 4}),
      flag({ayah: 22, word: 4}),
      flag({kind: 'possible_vowel', ayah: 1}),
    ];
    expect(shownFlags(flags, new Set()).map(f => f.key)).toEqual([
      'skippedWord:18:22:4',
      'skippedWord:18:30:1',
    ]);
  });

  it('flagKey is stable', () => {
    expect(flagKey({kind: 'skippedAyah', surah: 2, ayah: 7, word: 0})).toBe(
      'skippedAyah:2:7:0',
    );
  });
});
