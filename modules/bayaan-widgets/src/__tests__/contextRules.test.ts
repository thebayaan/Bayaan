// modules/bayaan-widgets/src/__tests__/contextRules.test.ts
import fs from 'fs';
import path from 'path';
import vectors from '../__fixtures__/context.vectors.json';
import tableJson from '../__fixtures__/hijri.table.json';
import committedNext from '../__fixtures__/next-occasions.vectors.json';
import {
  adhkarPeriod,
  adhkarRelevance,
  BayaanNowMode,
  bayaanNowMode,
  bayaanNowRelevance,
  bedtimeRelevance,
  buildNextOccasionVectors,
  HijriDate,
  hijriLookup,
  nextBoundaryMinutes,
  nextOccasions,
  OCCASION_WINDOWS,
  OccasionId,
  occasionFor,
  occasionRelevance,
  parseHijriTable,
  sleepTimerActive,
} from '../contextRules';

type Triple = [number, number, number];

function hijri(t: Triple | null): HijriDate | null {
  return t ? {year: t[0], month: t[1], day: t[2]} : null;
}

const table = parseHijriTable(tableJson);
if (!table) throw new Error('hijri.table.json is malformed');
const lookup = hijriLookup(table);

describe('adhkarPeriod', () => {
  it.each(vectors.adhkarPeriod as [number, string][])(
    'hour %d is %s',
    (hour, expected) => {
      expect(adhkarPeriod(hour)).toBe(expected);
    },
  );
});

describe('occasionFor', () => {
  it.each(
    vectors.occasion as {
      hijri: Triple | null;
      weekday: number;
      hour: number;
      expect: string | null;
    }[],
  )('%j', v => {
    expect(occasionFor(hijri(v.hijri), v.weekday, v.hour)).toBe(v.expect);
  });

  it('has generated data for every occasion id', () => {
    const file = path.resolve(
      __dirname,
      '../../../../targets/widgets/occasions.json',
    );
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      occasions: {id: string}[];
    };
    const ids = data.occasions.map(o => o.id);
    expect(ids).toEqual([...OCCASION_WINDOWS.map(w => w.id), 'jumuah']);
  });
});

describe('Bayaan Now', () => {
  it.each(
    vectors.mode as {
      hour: number;
      playing: boolean;
      occasion: OccasionId | null;
      expect: BayaanNowMode;
      relevance: number;
    }[],
  )('%j', v => {
    const mode = bayaanNowMode(v.hour, v.playing, v.occasion);
    expect(mode).toBe(v.expect);
    expect(bayaanNowRelevance(mode, v.playing)).toBeCloseTo(v.relevance);
  });
});

describe('Bayaan Now with cards turned off', () => {
  it('falls back to listening in the adhkar and bedtime hours', () => {
    const noAdhkar = {adhkar: false, bedtime: true};
    const noBedtime = {adhkar: true, bedtime: false};
    expect(bayaanNowMode(8, false, null, noAdhkar)).toBe('listening');
    expect(bayaanNowMode(17, false, null, noAdhkar)).toBe('listening');
    expect(bayaanNowMode(22, false, null, noAdhkar)).toBe('bedtime');
    expect(bayaanNowMode(22, false, null, noBedtime)).toBe('listening');
    expect(bayaanNowMode(8, false, null, noBedtime)).toBe('morningAdhkar');
    expect(bayaanNowMode(8, false, 'jumuah', noAdhkar)).toBe('occasion');
    expect(bayaanNowMode(8, true, null, noAdhkar)).toBe('listening');
  });
});

describe('single widget relevance', () => {
  it('matches the vectors', () => {
    for (const [hour, r] of vectors.adhkarRelevance as [number, number][])
      expect(adhkarRelevance(hour)).toBeCloseTo(r);
    for (const [o, r] of vectors.occasionRelevance as [
      OccasionId | null,
      number,
    ][])
      expect(occasionRelevance(o)).toBeCloseTo(r);
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

describe('Hijri table', () => {
  it('covers 2026 to 2028 with the Umm al-Qura anchor', () => {
    expect(table.from).toBe(20454);
    expect(table.rows).toHaveLength(1096);
    expect(lookup(20502)).toEqual({year: 1447, month: 9, day: 1});
    expect(lookup(20453)).toBeNull();
    expect(lookup(21550)).toBeNull();
  });

  it('rejects malformed tables', () => {
    expect(parseHijriTable({from: 1, rows: [[1, 2]]})).toBeNull();
    expect(parseHijriTable(null)).toBeNull();
  });
});

describe('nextOccasions', () => {
  it('finds each anchor on the first matching day after today', () => {
    const today = 20454;
    const found = nextOccasions(today, lookup, 6);
    expect(found).toHaveLength(6);
    for (const o of found) {
      const h = lookup(today + o.days);
      if (!h) throw new Error(`no table row for ${today + o.days}`);
      expect(occasionAnchorHit(o.id, h)).toBe(true);
      for (let d = 1; d < o.days; d++) {
        const earlier = lookup(today + d);
        if (earlier) expect(occasionAnchorHit(o.id, earlier)).toBe(false);
      }
    }
    expect([...found].sort((a, b) => a.days - b.days)).toEqual(found);
  });

  it('never reports today and stops when the converter runs out', () => {
    expect(nextOccasions(20502, lookup, 6).every(o => o.days >= 1)).toBe(true);
    expect(nextOccasions(21540, lookup, 6).length).toBeLessThan(6);
  });

  it('matches the committed vectors (run npm run generate:widget-vectors after changing rules)', () => {
    expect(buildNextOccasionVectors(table)).toEqual(committedNext.cases);
    expect(committedNext.count).toBe(3);
  });
});

function occasionAnchorHit(id: OccasionId, h: HijriDate): boolean {
  const anchors: Record<string, [number, number]> = {
    ramadan: [9, 1],
    eidFitr: [10, 1],
    dhulHijjah: [12, 1],
    arafah: [12, 9],
    eidAdha: [12, 10],
    ashura: [1, 10],
  };
  const a = anchors[id];
  return a !== undefined && a[0] === h.month && a[1] === h.day;
}
