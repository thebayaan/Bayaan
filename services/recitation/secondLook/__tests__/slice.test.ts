import followerConstants from '../../followerConstants.npl.json';
import {
  CANCEL_MAY_CANCEL,
  CHECK_TIMEOUT_MS,
  JUDGE,
  JUDGE_STEP,
  SECOND_LOOK_ENABLED,
} from '../config';
import {
  judgeSlice,
  melRange,
  paddedRange,
  withSilence,
  type SlicePlaces,
} from '../slice';
import cancelGolden from './fixtures/cancelGolden.json';
import golden from './fixtures/sliceGolden.json';

// The goldens come from lib.mjs's judgeSlice and judge/model.mjs's sliceFrames
// (scripts/second-look/gen_goldens.mjs).

function placesOf(c: (typeof golden.slices)[number]): SlicePlaces {
  const tracked = c.tracked as Record<string, number>;
  const cursor = (c as {cursor?: Record<string, number>}).cursor ?? {};
  const counts = golden.counts as Record<string, number>;
  return {
    wordFrames: ({surah, ayah, word}) => {
      const from = tracked[`${surah}:${ayah}:${word}`];
      return from === undefined ? null : {from, to: from};
    },
    ayahEnteredAt: (surah, ayah) => cursor[`${surah}:${ayah}`] ?? null,
    wordCount: (surah, ayah) => counts[`${surah}:${ayah}`] ?? 0,
  };
}

describe('judgeSlice', () => {
  it.each(golden.slices.map(c => [c.name, c] as const))(
    'matches the original: %s',
    (_name, c) => {
      const [surah, ayah] = c.id.split(':').map(Number);
      const {start, end} = judgeSlice(placesOf(c), surah, ayah, c.t, c.length);
      expect({start, end}).toEqual({start: c.start, end: c.end});
    },
  );
});

describe('melRange', () => {
  it.each(golden.slices.map(c => [c.name, c] as const))(
    'matches the original: %s',
    (_name, c) => {
      const {first, last} = melRange(c.start, c.end);
      expect(first).toBe(c.first);
      expect(last - first).toBe(c.frames);
    },
  );
});

describe('paddedRange', () => {
  it.each(cancelGolden.cuts.map(c => [c.name, c] as const))(
    'matches the original: %s',
    (_name, c) => {
      const range = paddedRange(c.from, c.to, c.limit, cancelGolden.stream);
      if (c.cut === null) {
        expect(range).toBeNull();
      } else {
        expect(range).toEqual({
          start: c.cut.start,
          end: c.cut.start + c.cut.samples,
        });
      }
    },
  );
});

describe('withSilence', () => {
  it('puts a second of digital silence each side', () => {
    const wave = new Float32Array([0.5, -0.5]);
    const out = withSilence(wave);
    expect(out).toHaveLength(32002);
    expect(out[15999]).toBe(0);
    expect(out[16000]).toBe(0.5);
    expect(out[16001]).toBe(-0.5);
    expect(out[16002]).toBe(0);
  });
});

describe('the frozen constants', () => {
  it('the second model set alone sit with the app', () => {
    expect(JUDGE).toEqual(golden.constants.judge);
  });

  it("the alternative's margin sits in the NPL file: the follower's sweep was seen before it was fixed", () => {
    expect('altMargin' in JUDGE).toBe(false);
    expect(followerConstants.secondJudge.altMargin).toBe(3);
  });

  it('those tuned on the follower sit in its NPL file', () => {
    expect(followerConstants.secondJudge).toMatchObject(
      golden.constants.follower,
    );
    expect(followerConstants.cancel).toMatchObject(golden.constants.cancel);
  });
});

describe('the switches, as they ship', () => {
  it('the check is on', () => {
    expect(SECOND_LOOK_ENABLED).toBe(true);
  });

  it('the judge wakes at Step 1', () => {
    expect(JUDGE_STEP).toBe(1);
  });

  it('the cancel step may cancel all marks', () => {
    expect(CANCEL_MAY_CANCEL).toBe('all');
  });

  it('no answer in 2 s shows the mark', () => {
    expect(CHECK_TIMEOUT_MS).toBe(2000);
  });
});
