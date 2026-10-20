import {estimateMinutes, nowListId} from '../services/adhkarBrowse';
import {
  collectionsFor,
  adhkarFacts,
  adhkarTileMeta,
  dayWindowAt,
  estimateAdhkarMinutes,
  estimateSurahMinutes,
  adhkarRowIds,
  homePlanAt,
  homeRows,
  HOME_ROW_ORDER,
  isFridayTime,
  planHourOf,
  planListIds,
  surahCaption,
  surahFacts,
  surahListMeta,
  formatMinutes,
  SURAH,
} from './homeMoments';
import {adhkarForList} from '../services/adhkarData';

// 2026-10-15 is a Thursday, 2026-10-16 a Friday, 2026-10-17 a Saturday.
const sat = (h: number, m = 0): Date => new Date(2026, 9, 17, h, m);
const fri = (h: number, m = 0): Date => new Date(2026, 9, 16, h, m);
const thu = (h: number, m = 0): Date => new Date(2026, 9, 15, h, m);

describe('dayWindowAt', () => {
  it.each([
    [0, 'night'],
    [3, 'night'],
    [4, 'morning'],
    [9, 'morning'],
    [10, 'day'],
    [14, 'day'],
    [15, 'evening'],
    [20, 'evening'],
    [21, 'night'],
    [23, 'night'],
  ])('%i:00 is %s', (hour, expected) => {
    expect(dayWindowAt(sat(hour))).toBe(expected);
  });

  it('switches exactly on the boundary minute', () => {
    expect(dayWindowAt(sat(3, 59))).toBe('night');
    expect(dayWindowAt(sat(9, 59))).toBe('morning');
    expect(dayWindowAt(sat(14, 59))).toBe('day');
    expect(dayWindowAt(sat(20, 59))).toBe('evening');
  });

  it("agrees with the Adhkar screen's list for the time", () => {
    for (let h = 0; h < 24; h++) {
      const window = dayWindowAt(sat(h));
      const list = nowListId(sat(h));
      if (window === 'evening') expect(list).toBe('evening-adhkar');
      if (window === 'night') expect(list).toBe('before-sleep');
      if (window === 'morning') expect(list).toBe('morning-adhkar');
    }
  });
});

describe('homePlanAt', () => {
  it('after Fajr: Morning adhkar, Yasin instead, a morning rail without either', () => {
    const plan = homePlanAt(sat(6, 41));
    expect(plan.hero).toMatchObject({
      kind: 'adhkar',
      kicker: 'AFTER FAJR',
      listId: 'morning-adhkar',
      insteadSurah: SURAH.yasin,
    });
    expect(plan.moments.title).toBe('This morning');
    expect(plan.moments.items.length).toBeGreaterThan(2);
    expect(plan.moments.items).not.toContainEqual({
      kind: 'adhkar',
      listId: 'morning-adhkar',
    });
    expect(plan.moments.items).not.toContainEqual({
      kind: 'surah',
      surahNumber: SURAH.yasin,
    });
  });

  it('evening: Evening adhkar with an evening rail', () => {
    const plan = homePlanAt(sat(17));
    expect(plan.hero).toMatchObject({kind: 'adhkar', listId: 'evening-adhkar'});
    expect(plan.moments.title).toBe('This evening');
    expect(plan.moments.items).not.toContainEqual({
      kind: 'adhkar',
      listId: 'evening-adhkar',
    });
  });

  it('night: Al-Mulk, Tonight rail with a before-sleep tile, no repeat of the hero', () => {
    const plan = homePlanAt(sat(22));
    expect(plan.hero).toMatchObject({kind: 'surah', surahNumber: SURAH.mulk});
    expect(plan.moments.title).toBe('Tonight');
    const items = plan.moments.items;
    expect(items).toContainEqual({kind: 'adhkar', listId: 'before-sleep'});
    expect(items).not.toContainEqual({kind: 'surah', surahNumber: SURAH.mulk});
  });

  it('after midnight is still night', () => {
    expect(homePlanAt(sat(2)).hero).toMatchObject({surahNumber: SURAH.mulk});
  });

  it('daytime: a surah of the day that follows the weekday, and a Today rail', () => {
    const plan = homePlanAt(sat(12));
    expect(plan.hero).toMatchObject({kind: 'surah', kicker: 'TODAY'});
    expect(plan.moments.title).toBe('Today');
    expect(plan.moments.items).not.toContainEqual({
      kind: 'surah',
      surahNumber: SURAH.qaf,
    });
    const sunday = homePlanAt(new Date(2026, 9, 18, 12));
    expect(sunday.hero).toMatchObject({surahNumber: SURAH.rahman});
  });

  it('every window has a rail', () => {
    for (let h = 0; h < 24; h++) {
      for (const date of [thu(h), fri(h), sat(h)]) {
        expect(homePlanAt(date).moments.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('the eve of Friday: Al-Kahf from Thursday night, with the Tonight moments', () => {
    expect(homePlanAt(thu(19)).hero).toMatchObject({kind: 'adhkar'});
    const plan = homePlanAt(thu(21, 12));
    expect(plan.isFriday).toBe(true);
    expect(plan.hero).toMatchObject({
      kind: 'surah',
      kicker: 'EVE OF FRIDAY',
      surahNumber: SURAH.kahf,
    });
    expect(plan.moments.items).toEqual([
      {kind: 'surah', surahNumber: SURAH.mulk},
      {kind: 'surah', surahNumber: SURAH.sajdah},
      {kind: 'surah', surahNumber: SURAH.waqiah},
      {kind: 'surah', surahNumber: SURAH.ikhlas},
      {kind: 'adhkar', listId: 'before-sleep'},
    ]);
  });

  it('Friday until the evening keeps Al-Kahf', () => {
    expect(homePlanAt(fri(1)).hero).toMatchObject({
      kicker: 'FRIDAY',
      surahNumber: SURAH.kahf,
    });
    const morning = homePlanAt(fri(6));
    expect(morning.hero).toMatchObject({surahNumber: SURAH.kahf});
    expect(morning.moments.title).toBe('This morning');
    expect(morning.moments.items[0]).toEqual({
      kind: 'adhkar',
      listId: 'morning-adhkar',
    });
    const noon = homePlanAt(fri(12));
    expect(noon.hero).toMatchObject({surahNumber: SURAH.kahf});
    expect(noon.moments.title).toBe('On Friday');
    expect(noon.moments.items[0]).toEqual({kind: 'adhkar', listId: 'salawat'});
  });

  it('Friday evening brings back the evening adhkar, then Al-Mulk', () => {
    const evening = homePlanAt(fri(17));
    expect(evening.isFriday).toBe(false);
    expect(evening.hero).toMatchObject({
      kind: 'adhkar',
      listId: 'evening-adhkar',
    });
    expect(homePlanAt(fri(21, 40)).hero).toMatchObject({
      surahNumber: SURAH.mulk,
    });
  });

  it('every adhkar the plan points at exists', () => {
    for (let h = 0; h < 24; h++) {
      for (const date of [sat(h), fri(h), thu(h)]) {
        const plan = homePlanAt(date);
        if (plan.hero.kind === 'adhkar') {
          expect(adhkarForList(plan.hero.listId).length).toBeGreaterThan(0);
        }
        for (const item of plan.moments.items) {
          if (item.kind === 'adhkar') {
            expect(adhkarForList(item.listId).length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe('isFridayTime and planHourOf', () => {
  it('runs from Thursday 20:00 to Friday 14:59', () => {
    expect(isFridayTime(thu(19, 59))).toBe(false);
    expect(isFridayTime(thu(20))).toBe(true);
    expect(isFridayTime(fri(0, 30))).toBe(true);
    expect(isFridayTime(fri(14, 59))).toBe(true);
    expect(isFridayTime(fri(15))).toBe(false);
    expect(isFridayTime(fri(22))).toBe(false);
    expect(isFridayTime(sat(10))).toBe(false);
  });

  it('is the same within an hour and changes when it turns', () => {
    expect(planHourOf(sat(9, 1))).toBe(planHourOf(sat(9, 59)));
    expect(planHourOf(sat(9, 59))).not.toBe(planHourOf(sat(10)));
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
    const one = {arabic: 'س'.repeat(14 * 60), repeatCount: 1};
    expect(estimateAdhkarMinutes([one])).toBe(1);
    expect(estimateAdhkarMinutes([{...one, repeatCount: 3}])).toBe(3);
    // The same time the Adhkar screen shows for the list.
    const morning = estimateAdhkarMinutes(adhkarForList('morning-adhkar'));
    expect(morning).toBe(estimateMinutes('morning-adhkar'));
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

  it('captions surah tiles and surah lists', () => {
    expect(surahCaption(SURAH.kahf)).toBe('110 verses · 41 min');
    expect(surahListMeta([])).toBe('No surahs yet');
    expect(surahListMeta([SURAH.ikhlas])).toBe('1 surah · 1 min');
    expect(surahListMeta([SURAH.kahf, SURAH.kahf])).toBe(
      '2 surahs · 1 h 22 min',
    );
  });

  it('formatMinutes writes hours from 60 minutes on', () => {
    expect(formatMinutes(59)).toBe('59 min');
    expect(formatMinutes(60)).toBe('1 h 0 min');
    expect(formatMinutes(134)).toBe('2 h 14 min');
  });
});

describe('homeRows', () => {
  it('shows only rails with content, in the fixed order', () => {
    expect(homeRows({featured: 3, moments: 4, continue: 0, adhkar: 2})).toEqual(
      ['moments', 'adhkar', 'featured'],
    );
  });

  it('keeps the full order when everything has content', () => {
    const all = Object.fromEntries(HOME_ROW_ORDER.map(r => [r, 1]));
    expect(homeRows(all)).toEqual(HOME_ROW_ORDER);
    expect(HOME_ROW_ORDER[0]).toBe('continue');
  });

  it('has no row of every reciter', () => {
    expect(HOME_ROW_ORDER).not.toContain('reciters');
  });
});

describe('adhkar rail', () => {
  it('leads with the list for the time and leaves out what the plan shows', () => {
    const night = homePlanAt(sat(22));
    const exclude = planListIds(night);
    expect(exclude).toEqual(['before-sleep']);
    const ids = adhkarRowIds(sat(22), exclude);
    expect(ids).not.toContain('before-sleep');
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(adhkarForList(id).length).toBeGreaterThan(0);
    }
    expect(adhkarRowIds(sat(13), [])[0]).toBe('morning-adhkar');
  });

  it("puts the other half of the day's list last", () => {
    const morning = adhkarRowIds(sat(9, 48), ['morning-adhkar'], 99);
    expect(morning[0]).not.toBe('evening-adhkar');
    if (morning.includes('evening-adhkar')) {
      expect(morning[morning.length - 1]).toBe('evening-adhkar');
    }
    const evening = adhkarRowIds(sat(17), ['evening-adhkar'], 99);
    expect(evening[0]).not.toBe('morning-adhkar');
    if (evening.includes('morning-adhkar')) {
      expect(evening[evening.length - 1]).toBe('morning-adhkar');
    }
  });

  it('counts the adhkar hero among the plan lists', () => {
    expect(planListIds(homePlanAt(sat(6)))[0]).toBe('morning-adhkar');
  });

  it('respects the limit', () => {
    expect(adhkarRowIds(sat(22), [], 2)).toHaveLength(2);
  });
});

describe('collectionsFor', () => {
  const all = [
    {id: 'most-loved'},
    {id: 'morning-reflections'},
    {id: 'quick-listen'},
    {id: 'evening-serenity'},
    {id: 'friday-essentials'},
    {id: 'protection-healing'},
  ];
  const ids = (list: {id: string}[]): string[] => list.map(c => c.id);

  it('leads with the collections for the time of day', () => {
    expect(
      ids(collectionsFor({window: 'morning', isFriday: false}, all)),
    ).toEqual([
      'morning-reflections',
      'protection-healing',
      'most-loved',
      'quick-listen',
      'evening-serenity',
      'friday-essentials',
    ]);
    expect(
      ids(collectionsFor({window: 'evening', isFriday: false}, all)).slice(
        0,
        2,
      ),
    ).toEqual(['evening-serenity', 'protection-healing']);
  });

  it('puts Friday Essentials first at Friday time', () => {
    expect(ids(collectionsFor({window: 'day', isFriday: true}, all))[0]).toBe(
      'friday-essentials',
    );
  });
});
