// modules/bayaan-widgets/src/__tests__/contextRules.test.ts
import vectors from '../__fixtures__/context.vectors.json';
import {
  adhkarPeriod,
  adhkarRelevance,
  BayaanNowMode,
  bayaanNowMode,
  bayaanNowRelevance,
  bedtimeRelevance,
  nextBoundaryMinutes,
  sleepTimerActive,
} from '../contextRules';

describe('adhkarPeriod', () => {
  it.each(vectors.adhkarPeriod as [number, string][])(
    'hour %d is %s',
    (hour, expected) => {
      expect(adhkarPeriod(hour)).toBe(expected);
    },
  );
});

describe('Bayaan Now', () => {
  it.each(
    vectors.mode as {
      hour: number;
      playing: boolean;
      expect: BayaanNowMode;
      relevance: number;
    }[],
  )('%j', v => {
    const mode = bayaanNowMode(v.hour, v.playing);
    expect(mode).toBe(v.expect);
    expect(bayaanNowRelevance(mode, v.playing)).toBeCloseTo(v.relevance);
  });
});

describe('Bayaan Now with cards turned off', () => {
  it('falls back to listening in the adhkar and bedtime hours', () => {
    const noAdhkar = {adhkar: false, bedtime: true};
    const noBedtime = {adhkar: true, bedtime: false};
    expect(bayaanNowMode(8, false, noAdhkar)).toBe('listening');
    expect(bayaanNowMode(17, false, noAdhkar)).toBe('listening');
    expect(bayaanNowMode(22, false, noAdhkar)).toBe('bedtime');
    expect(bayaanNowMode(22, false, noBedtime)).toBe('listening');
    expect(bayaanNowMode(8, false, noBedtime)).toBe('morningAdhkar');
    expect(bayaanNowMode(8, true, noAdhkar)).toBe('listening');
  });
});

describe('single widget relevance', () => {
  it('matches the vectors', () => {
    for (const [hour, r] of vectors.adhkarRelevance as [number, number][])
      expect(adhkarRelevance(hour)).toBeCloseTo(r);
    for (const [hour, r] of vectors.bedtimeRelevance as [number, number][])
      expect(bedtimeRelevance(hour)).toBeCloseTo(r);
  });
});

describe('nextBoundaryMinutes', () => {
  it.each(vectors.nextBoundary as [number, number][])(
    '%d -> %d',
    (m, expected) => {
      expect(nextBoundaryMinutes(m)).toBe(expected);
    },
  );
});

describe('sleepTimerActive', () => {
  it.each(vectors.sleepActive as [number | null, number, boolean][])(
    '%j at %d is %s',
    (endsAt, now, expected) => {
      expect(sleepTimerActive(endsAt, now)).toBe(expected);
    },
  );
});
