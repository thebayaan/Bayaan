import {
  adhkarFacts,
  adhkarTileMeta,
  dayWindowAt,
  estimateAdhkarMinutes,
  estimateSurahMinutes,
  homePlanAt,
  homeSections,
  quickPicks,
  surahFacts,
  SURAH,
} from './homeMoments';
import {adhkarForList} from '../services/adhkarData';

// 2026-10-16 is a Friday; 2026-10-17 a Saturday.
const sat = (h: number, m = 0): Date => new Date(2026, 9, 17, h, m);
const fri = (h: number, m = 0): Date => new Date(2026, 9, 16, h, m);

describe('dayWindowAt', () => {
  it.each([
    [0, 'night'],
    [3, 'night'],
    [4, 'morning'],
    [9, 'morning'],
    [10, 'day'],
    [15, 'day'],
    [16, 'evening'],
    [19, 'evening'],
    [20, 'night'],
    [23, 'night'],
  ])('%i:00 is %s', (hour, expected) => {
    expect(dayWindowAt(sat(hour))).toBe(expected);
  });

  it('switches exactly on the boundary minute', () => {
    expect(dayWindowAt(sat(3, 59))).toBe('night');
    expect(dayWindowAt(sat(9, 59))).toBe('morning');
    expect(dayWindowAt(sat(15, 59))).toBe('day');
    expect(dayWindowAt(sat(19, 59))).toBe('evening');
  });
});

describe('homePlanAt', () => {
  it('after Fajr: Morning adhkar, Yasin instead, reciters rail', () => {
    const plan = homePlanAt(sat(6, 41));
    expect(plan.hero).toMatchObject({
      kind: 'adhkar',
      kicker: 'AFTER FAJR',
      listId: 'morning-adhkar',
      insteadSurah: SURAH.yasin,
    });
    expect(plan.moments).toBeNull();
  });

  it('evening: Evening adhkar', () => {
    const plan = homePlanAt(sat(17));
    expect(plan.hero).toMatchObject({kind: 'adhkar', listId: 'evening-adhkar'});
    expect(plan.moments).toBeNull();
  });

  it('night: Al-Mulk, Tonight rail with a before-sleep tile, no repeat of the hero', () => {
    const plan = homePlanAt(sat(22));
    expect(plan.hero).toMatchObject({kind: 'surah', surahNumber: SURAH.mulk});
    expect(plan.moments?.title).toBe('Tonight');
    const items = plan.moments?.items ?? [];
    expect(items).toContainEqual({kind: 'adhkar', listId: 'before-sleep'});
    expect(items).not.toContainEqual({kind: 'surah', surahNumber: SURAH.mulk});
  });

  it('after midnight is still night', () => {
    expect(homePlanAt(sat(2)).hero).toMatchObject({surahNumber: SURAH.mulk});
  });

  it('daytime: a surah of the day that follows the weekday', () => {
    const plan = homePlanAt(sat(12));
    expect(plan.hero).toMatchObject({kind: 'surah', kicker: 'TODAY'});
    expect(plan.moments).toBeNull();
    const sunday = homePlanAt(new Date(2026, 9, 18, 12));
    expect(sunday.hero).toMatchObject({surahNumber: SURAH.rahman});
  });

  it('Friday evening: Al-Kahf with the Tonight moments (mockup 00)', () => {
    const plan = homePlanAt(fri(21, 12));
    expect(plan.isFriday).toBe(true);
    expect(plan.hero).toMatchObject({
      kind: 'surah',
      kicker: 'FRIDAY',
      surahNumber: SURAH.kahf,
    });
    expect(plan.moments?.items).toEqual([
      {kind: 'surah', surahNumber: SURAH.mulk},
      {kind: 'surah', surahNumber: SURAH.sajdah},
      {kind: 'surah', surahNumber: SURAH.waqiah},
      {kind: 'surah', surahNumber: SURAH.ikhlas},
      {kind: 'adhkar', listId: 'before-sleep'},
    ]);
  });

  it('Friday all day: morning and daytime keep Al-Kahf', () => {
    const morning = homePlanAt(fri(6));
    expect(morning.hero).toMatchObject({surahNumber: SURAH.kahf});
    expect(morning.moments?.title).toBe('This morning');
    expect(morning.moments?.items[0]).toEqual({
      kind: 'adhkar',
      listId: 'morning-adhkar',
    });
    const noon = homePlanAt(fri(12));
    expect(noon.hero).toMatchObject({surahNumber: SURAH.kahf});
    expect(noon.moments?.items[0]).toEqual({kind: 'adhkar', listId: 'salawat'});
    expect(homePlanAt(fri(17)).moments?.title).toBe('This evening');
  });

  it('every adhkar the plan points at exists', () => {
    for (let h = 0; h < 24; h++) {
      for (const date of [sat(h), fri(h)]) {
        const plan = homePlanAt(date);
        if (plan.hero.kind === 'adhkar') {
          expect(adhkarForList(plan.hero.listId).length).toBeGreaterThan(0);
        }
        for (const item of plan.moments?.items ?? []) {
          if (item.kind === 'adhkar') {
            expect(adhkarForList(item.listId).length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe('estimates and copy', () => {
  it('Al-Kahf takes about 41 minutes (mockup)', () => {
    expect(estimateSurahMinutes(SURAH.kahf)).toBe(41);
  });

  it('short surahs take at least a minute', () => {
    expect(estimateSurahMinutes(SURAH.ikhlas)).toBe(1);
    expect(estimateSurahMinutes(108)).toBe(1);
  });

  it('unknown surahs fall back to a few minutes', () => {
    expect(estimateSurahMinutes(999)).toBe(5);
  });

  it('adhkar minutes count repeats and never go below one', () => {
    expect(estimateAdhkarMinutes([])).toBe(1);
    const one = {arabic: 'x'.repeat(45 * 60), repeatCount: 1};
    expect(estimateAdhkarMinutes([one])).toBe(1);
    expect(estimateAdhkarMinutes([{...one, repeatCount: 3}])).toBe(3);
    const morning = estimateAdhkarMinutes(adhkarForList('morning-adhkar'));
    expect(morning).toBeGreaterThanOrEqual(10);
    expect(morning).toBeLessThanOrEqual(20);
  });

  it('builds the hero sentences', () => {
    expect(surahFacts(SURAH.kahf, 'Al-Minshawi')).toBe(
      '110 verses, about 41 minutes with Al-Minshawi.',
    );
    expect(surahFacts(SURAH.ikhlas, null)).toBe('4 verses, about a minute.');
    expect(adhkarFacts(24, 14)).toBe(
      '24 adhkar from Hisn al-Muslim, about 14 minutes, read along with the words on screen.',
    );
    expect(adhkarTileMeta(13, 6)).toBe('13 adhkar · 6 min');
  });

  it('quick picks leave out the hero surah', () => {
    expect(quickPicks(SURAH.kahf)).not.toContain(SURAH.kahf);
    expect(quickPicks(null)).toContain(SURAH.kahf);
  });
});

describe('homeSections', () => {
  it('first launch: quick picks and reciters', () => {
    expect(
      homeSections({hasContinue: false, hasHistory: false, hasMoments: true}),
    ).toEqual(['quickPicks', 'reciters']);
  });

  it('continue leads, then moments (mockup 00) or reciters (mockup 01)', () => {
    expect(
      homeSections({hasContinue: true, hasHistory: true, hasMoments: true}),
    ).toEqual(['continue', 'moments']);
    expect(
      homeSections({hasContinue: true, hasHistory: true, hasMoments: false}),
    ).toEqual(['continue', 'reciters']);
  });

  it('history without anything to resume', () => {
    expect(
      homeSections({hasContinue: false, hasHistory: true, hasMoments: true}),
    ).toEqual(['moments', 'reciters']);
    expect(
      homeSections({hasContinue: false, hasHistory: true, hasMoments: false}),
    ).toEqual(['quickPicks', 'reciters']);
  });
});
