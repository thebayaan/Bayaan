import {buildSituationalPicks, SituationalContext} from '../situational';

const allSurahs = Array.from({length: 114}, (_, i) => i + 1);

function ctx(
  now: Date,
  overrides: Partial<SituationalContext> = {},
): SituationalContext {
  return {
    now,
    topReciter: {
      reciterId: 'r1',
      rewayatId: 'rw1',
      name: 'Mishary Alafasy',
      surahIds: allSurahs,
    },
    lastPlayed: null,
    systemPlaylists: [
      {
        id: 'morning-reflections',
        title: 'Morning Reflections',
        color: '#F59E0B',
        surahCount: 12,
      },
      {
        id: 'evening-serenity',
        title: 'Evening Serenity',
        color: '#1E3A8A',
        surahCount: 8,
      },
      {
        id: 'quick-listen',
        title: 'Quick Listen',
        color: '#10B981',
        surahCount: 1,
      },
    ],
    surahName: (id: number): string => `Surah ${id}`,
    ...overrides,
  };
}

// Months are 0-based. 2026-10-08 is a Thursday.
const thu1759 = new Date(2026, 9, 8, 17, 59);
const thu1800 = new Date(2026, 9, 8, 18, 0);
const fri1859 = new Date(2026, 9, 9, 18, 59);
const fri1900 = new Date(2026, 9, 9, 19, 0);
const sat0800 = new Date(2026, 9, 10, 8, 0);
const sat1400 = new Date(2026, 9, 10, 14, 0);
const sat2200 = new Date(2026, 9, 10, 22, 0);

describe('buildSituationalPicks', () => {
  it('offers Al-Kahf from Thursday 18:00', () => {
    const ids = buildSituationalPicks(ctx(thu1800)).map(p => p.id);
    expect(ids).toContain('now:kahf');
  });

  it('does not offer Al-Kahf on Thursday 17:59', () => {
    const ids = buildSituationalPicks(ctx(thu1759)).map(p => p.id);
    expect(ids).not.toContain('now:kahf');
  });

  it('offers Al-Kahf until Friday 18:59 and stops at 19:00', () => {
    expect(buildSituationalPicks(ctx(fri1859)).map(p => p.id)).toContain(
      'now:kahf',
    );
    expect(buildSituationalPicks(ctx(fri1900)).map(p => p.id)).not.toContain(
      'now:kahf',
    );
  });

  it('plays Al-Kahf with the top reciter', () => {
    const kahf = buildSituationalPicks(ctx(thu1800)).find(
      p => p.id === 'now:kahf',
    );
    expect(kahf?.action).toEqual({
      kind: 'play',
      request: {kind: 'surah', reciterId: 'r1', rewayatId: 'rw1', surahId: 18},
    });
    expect(kahf?.title).toBe('Surah 18');
    expect(kahf?.subtitle).toBe('Friday');
    expect(kahf?.artwork).toEqual({kind: 'surah', surahId: 18});
  });

  it('skips Al-Kahf when the top rewayah lacks surah 18', () => {
    const c = ctx(thu1800, {
      topReciter: {
        reciterId: 'r1',
        rewayatId: 'rw1',
        name: 'X',
        surahIds: [1, 2, 3],
      },
    });
    expect(buildSituationalPicks(c).map(p => p.id)).not.toContain('now:kahf');
  });

  it('offers Morning Reflections in the morning', () => {
    const ids = buildSituationalPicks(ctx(sat0800)).map(p => p.id);
    expect(ids).toEqual(['now:morning']);
  });

  it('offers Al-Mulk and Evening Serenity at night', () => {
    const ids = buildSituationalPicks(ctx(sat2200)).map(p => p.id);
    expect(ids).toEqual(['now:mulk', 'now:evening']);
  });

  it('titles each card by what plays; surahs say why now, playlists their size', () => {
    const night = buildSituationalPicks(ctx(sat2200)).map(p => [
      p.title,
      p.subtitle,
    ]);
    expect(night).toEqual([
      ['Surah 67', 'Bedtime'],
      ['Evening Serenity', '8 surahs'],
    ]);
    const morning = buildSituationalPicks(ctx(sat0800)).map(p => [
      p.title,
      p.subtitle,
    ]);
    expect(morning).toEqual([['Morning Reflections', '12 surahs']]);
    expect(buildSituationalPicks(ctx(sat0800))[0].artwork).toEqual({
      kind: 'icon',
      name: 'playlist',
      hex: '#F59E0B',
    });
  });

  it('offers the next surah after a completed one', () => {
    const c = ctx(sat1400, {
      lastPlayed: {
        reciterId: 'r2',
        rewayatId: 'rw2',
        reciterName: 'Sudais',
        surahId: 2,
        completed: true,
        surahIds: [1, 2, 3],
      },
    });
    const next = buildSituationalPicks(c).find(p => p.id === 'now:upnext');
    expect(next?.action).toEqual({
      kind: 'play',
      request: {kind: 'surah', reciterId: 'r2', rewayatId: 'rw2', surahId: 3},
    });
    expect(next?.title).toBe('Surah 3');
    expect(next?.subtitle).toBe('Up next');
  });

  it('skips up next when the last surah is the last available one', () => {
    const c = ctx(sat1400, {
      lastPlayed: {
        reciterId: 'r2',
        rewayatId: 'rw2',
        reciterName: 'S',
        surahId: 3,
        completed: true,
        surahIds: [1, 2, 3],
      },
    });
    expect(buildSituationalPicks(c).map(p => p.id)).not.toContain('now:upnext');
  });

  it('skips up next when the last surah is not completed', () => {
    const c = ctx(sat1400, {
      lastPlayed: {
        reciterId: 'r2',
        rewayatId: 'rw2',
        reciterName: 'S',
        surahId: 2,
        completed: false,
        surahIds: [1, 2, 3],
      },
    });
    expect(buildSituationalPicks(c).map(p => p.id)).not.toContain('now:upnext');
  });

  it('returns nothing reciter-based without a top reciter', () => {
    const ids = buildSituationalPicks(ctx(sat2200, {topReciter: null})).map(
      p => p.id,
    );
    expect(ids).toEqual(['now:evening']);
  });

  it('treats 03:59 as night and 04:00 as morning', () => {
    const at0359 = new Date(2026, 9, 10, 3, 59);
    const at0400 = new Date(2026, 9, 10, 4, 0);
    expect(buildSituationalPicks(ctx(at0359)).map(p => p.id)).toEqual([
      'now:mulk',
      'now:evening',
    ]);
    expect(buildSituationalPicks(ctx(at0400)).map(p => p.id)).toEqual([
      'now:morning',
    ]);
  });

  it('treats 10:59 as morning and 11:00 as outside morning', () => {
    const at1059 = new Date(2026, 9, 10, 10, 59);
    const at1100 = new Date(2026, 9, 10, 11, 0);
    expect(buildSituationalPicks(ctx(at1059)).map(p => p.id)).toEqual([
      'now:morning',
    ]);
    expect(buildSituationalPicks(ctx(at1100)).map(p => p.id)).toEqual([
      'now:afternoon',
    ]);
  });

  it('treats 20:59 as evening and 21:00 as night', () => {
    const at2059 = new Date(2026, 9, 10, 20, 59);
    const at2100 = new Date(2026, 9, 10, 21, 0);
    expect(buildSituationalPicks(ctx(at2059)).map(p => p.id)).toEqual([
      'now:evening',
    ]);
    expect(buildSituationalPicks(ctx(at2100)).map(p => p.id)).toEqual([
      'now:mulk',
      'now:evening',
    ]);
  });

  it('offers Quick Listen in the afternoon until 16:59', () => {
    const at1659 = new Date(2026, 9, 10, 16, 59);
    const at1700 = new Date(2026, 9, 10, 17, 0);
    const afternoon = buildSituationalPicks(ctx(at1659));
    expect(afternoon.map(p => p.id)).toEqual(['now:afternoon']);
    expect(afternoon[0].title).toBe('Quick Listen');
    expect(afternoon[0].subtitle).toBe('1 surah');
    expect(afternoon[0].action).toEqual({
      kind: 'play',
      request: {kind: 'playlist', playlistId: 'quick-listen', system: true},
    });
    expect(buildSituationalPicks(ctx(at1700)).map(p => p.id)).toEqual([
      'now:evening',
    ]);
  });

  it('has a pick at every hour of a weekday', () => {
    for (let hour = 0; hour < 24; hour++) {
      const at = new Date(2026, 9, 10, hour, 30);
      expect(buildSituationalPicks(ctx(at)).length).toBeGreaterThan(0);
    }
  });
});
