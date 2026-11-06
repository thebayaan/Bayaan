// @ai-generated
import {
  playbackCapability,
  surahsBetween,
  type PlaybackCapabilityDeps,
  type SurahTimingCheck,
} from '../playbackCapability';

function deps(
  overrides: Partial<PlaybackCapabilityDeps> = {},
): PlaybackCapabilityDeps {
  return {
    catalogLoaded: () => true,
    isListed: () => true,
    hasSource: () => true,
    hasSurah: () => true,
    ...overrides,
  };
}

describe('surahsBetween', () => {
  it('lists the surahs in reading order', () => {
    expect(surahsBetween(2, 4)).toEqual([2, 3, 4]);
    expect(surahsBetween(112, 112)).toEqual([112]);
  });

  it('is empty for anything that is not a surah range', () => {
    expect(surahsBetween(0, 2)).toEqual([]);
    expect(surahsBetween(114, 115)).toEqual([]);
    expect(surahsBetween(5, 4)).toEqual([]);
  });
});

describe('playbackCapability', () => {
  it('is ok for a timed reciter covering the selection', () => {
    expect(playbackCapability('r', [1, 2], deps())).toEqual({kind: 'ok'});
  });

  it('says nothing about a reciter before the catalog has loaded', () => {
    const result = playbackCapability(
      'r',
      [1],
      deps({catalogLoaded: () => false, hasSource: () => false}),
    );
    expect(result).toEqual({kind: 'catalog-loading'});
  });

  it('tells a removed reciter from one without timing', () => {
    const noSource = {hasSource: () => false};
    expect(
      playbackCapability('r', [1], deps({...noSource, isListed: () => false})),
    ).toEqual({kind: 'reciter-removed'});
    expect(playbackCapability('r', [1], deps(noSource))).toEqual({
      kind: 'reciter-untimed',
    });
  });

  it('names the first surah of the range that is not covered', () => {
    const result = playbackCapability(
      'r',
      [1, 2, 3, 4],
      deps({hasSurah: (_, surah) => surah === 1 || surah === 2}),
    );
    expect(result).toEqual({kind: 'surah-not-covered', surah: 3});
  });

  it('reports what a check of a covered surah found', () => {
    const cases: [SurahTimingCheck, object][] = [
      [{status: 'not-covered'}, {kind: 'surah-not-covered', surah: 2}],
      [{status: 'numbering-mismatch'}, {kind: 'numbering-mismatch', surah: 2}],
      [
        {status: 'failed', reason: 'offline'},
        {kind: 'timing-failed', surah: 2, reason: 'offline'},
      ],
    ];
    for (const [check, expected] of cases) {
      const result = playbackCapability(
        'r',
        [1, 2],
        deps({
          surahCheck: (_, surah) => (surah === 2 ? check : {status: 'ok'}),
        }),
      );
      expect(result).toEqual(expected);
    }
  });

  it('treats an unchecked surah as playable for now', () => {
    const result = playbackCapability(
      'r',
      [1],
      deps({surahCheck: () => ({status: 'unknown'})}),
    );
    expect(result).toEqual({kind: 'ok'});
  });

  it('prefers a catalog answer over a check of an earlier surah', () => {
    const result = playbackCapability(
      'r',
      [1, 2],
      deps({
        hasSurah: (_, surah) => surah === 1,
        surahCheck: () => ({status: 'failed', reason: 'server'}),
      }),
    );
    expect(result).toEqual({kind: 'surah-not-covered', surah: 2});
  });
});
