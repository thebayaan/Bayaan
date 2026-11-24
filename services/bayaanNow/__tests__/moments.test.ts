// @ai-generated
import {fromHijri} from '../calendar';
import {
  bayaanNowMoments,
  calendarDay,
  sceneFor,
  isFridayWindow,
  nextMomentChange,
  type NowInput,
} from '../moments';

const ALL = Array.from({length: 114}, (_, i) => i + 1);
const reciter = {reciterId: 'r1', rewayatId: 'hafs', surahIds: ALL};
const playlists = ['morning-reflections', 'quick-listen', 'evening-serenity'];

// 2026-11-23 is a Monday.
function at(day: number, hour: number): Date {
  return new Date(2026, 10, 23 + day, hour, 30);
}

function input(now: Date, extra: Partial<NowInput> = {}): NowInput {
  return {
    now,
    topReciter: reciter,
    lastPlayed: null,
    playlistIds: playlists,
    ...extra,
  };
}

const ids = (i: NowInput) => bayaanNowMoments(i).map(m => m.id);

describe('bayaanNowMoments', () => {
  it('leads with morning adhkar, then the morning playlist', () => {
    expect(ids(input(at(0, 7)))).toEqual([
      'adhkar:morning-adhkar',
      'playlist:morning-reflections',
    ]);
  });

  it('puts Al-Kahf first on Friday morning, with the hour after it', () => {
    expect(ids(input(at(4, 8)))).toEqual(['surah:18', 'adhkar:morning-adhkar']);
  });

  it('starts the Friday window on Thursday at 6 PM', () => {
    expect(isFridayWindow(at(3, 17))).toBe(false);
    expect(isFridayWindow(at(3, 18))).toBe(true);
    expect(isFridayWindow(at(4, 18))).toBe(true);
    expect(isFridayWindow(at(4, 19))).toBe(false);
  });

  it('offers evening adhkar from 3 PM', () => {
    expect(ids(input(at(1, 16)))[0]).toBe('adhkar:evening-adhkar');
  });

  it('offers Al-Mulk with a sleep timer at night, then sleep adhkar', () => {
    const [main, second] = bayaanNowMoments(input(at(1, 23)));
    expect(main).toMatchObject({kind: 'bedtime', surahId: 67});
    expect(second).toMatchObject({kind: 'adhkar', superId: 'before-sleep'});
  });

  it('offers the next surah at midday after a finished one', () => {
    const lastPlayed = {...reciter, surahId: 36, completed: true};
    expect(ids(input(at(1, 12), {lastPlayed}))).toEqual([
      'surah:37',
      'playlist:quick-listen',
    ]);
  });

  it('skips the next surah when the last one was not finished', () => {
    const lastPlayed = {...reciter, surahId: 36, completed: false};
    expect(ids(input(at(1, 12), {lastPlayed}))).toEqual([
      'playlist:quick-listen',
    ]);
  });

  it('lets a backend slot lead, with its own look and words', () => {
    const moments = bayaanNowMoments(
      input(at(4, 8), {
        occasion: [
          {
            action: {kind: 'surah', surahId: 97},
            look: {kind: 'scene', scene: 'qadr'},
            content: {title: {en: 'Seek Laylat al-Qadr'}},
          },
        ],
      }),
    );
    expect(moments.map(m => m.id)).toEqual(['surah:97', 'surah:18']);
    expect(moments[0].reason).toBe('occasion');
    expect(moments[0].look).toEqual({kind: 'scene', scene: 'qadr'});
    expect(moments[0].content?.title).toEqual({en: 'Seek Laylat al-Qadr'});
  });

  it("restyles the rules' cards when a slot has no action", () => {
    const image = {kind: 'image' as const, uri: 'https://x.test/a.jpg'};
    const moments = bayaanNowMoments(
      input(at(4, 8), {occasion: [{}, {look: image}]}),
    );
    expect(moments.map(m => m.id)).toEqual([
      'surah:18',
      'adhkar:morning-adhkar',
    ]);
    expect(moments[0].look).toBeUndefined();
    expect(moments[1].look).toEqual(image);
  });

  it('plays a named reciter only when it can be found', () => {
    const named = {kind: 'surah' as const, surahId: 36, reciterId: 'r2'};
    expect(ids(input(at(0, 7), {occasion: [{action: named}]}))[0]).toBe(
      'adhkar:morning-adhkar',
    );
    const found = bayaanNowMoments(
      input(at(0, 7), {
        occasion: [{action: named}],
        resolveReciter: () => ({...reciter, reciterId: 'r2'}),
      }),
    );
    expect(found[0]).toMatchObject({id: 'surah:36', reciterId: 'r2'});
  });

  it('falls back to playlists without a reciter', () => {
    expect(ids(input(at(1, 23), {topReciter: null}))).toEqual([
      'adhkar:before-sleep',
      'playlist:quick-listen',
    ]);
  });

  it('respects a fork that turns adhkar off', () => {
    const cards = {adhkar: false, bedtime: true};
    expect(ids(input(at(0, 7), {cards}))[0]).toBe('playlist:quick-listen');
  });
});

describe('nextMomentChange', () => {
  it('finds the next boundary today, or midnight', () => {
    expect(nextMomentChange(at(0, 7)).getHours()).toBe(11);
    const late = nextMomentChange(at(0, 22));
    expect(late.getHours()).toBe(0);
    expect(late.getDate()).toBe(24);
  });
});

/** A Hijri date at a given hour, for the calendar's rules. */
function hijri(year: number, month: number, day: number, hour: number): Date {
  const date = fromHijri(year, month, day);
  date.setHours(hour, 30);
  return date;
}

describe('the Hijri calendar', () => {
  it('seeks Laylat al-Qadr on the odd nights of the last ten', () => {
    // The 27th night starts the evening of the 26th.
    const odd = bayaanNowMoments(input(hijri(1448, 9, 26, 22)));
    expect(odd[0]).toMatchObject({id: 'surah:97', reason: 'qadr'});
    expect(ids(input(hijri(1448, 9, 25, 22)))[0]).not.toBe('surah:97');
  });

  it('makes dua on the Day of Arafah, not the evening before', () => {
    expect(ids(input(hijri(1448, 12, 9, 10)))[0]).toBe('adhkar:quranic-duas');
    expect(ids(input(hijri(1448, 12, 8, 20)))[0]).not.toBe(
      'adhkar:quranic-duas',
    );
  });

  it('tells of Musa and the sea on Ashura', () => {
    expect(ids(input(hijri(1449, 1, 10, 13)))[0]).toBe('surah:26');
  });

  it('restyles the first card on the special days', () => {
    expect(calendarDay(hijri(1448, 10, 1, 9))).toEqual({kind: 'eidFitr'});
    expect(calendarDay(hijri(1448, 12, 11, 9))).toEqual({kind: 'eidAdha'});
    expect(calendarDay(hijri(1448, 9, 12, 9))).toEqual({
      kind: 'ramadan',
      day: 12,
    });
    expect(calendarDay(hijri(1449, 1, 1, 9))).toEqual({
      kind: 'newYear',
      year: 1449,
    });
    const [main] = bayaanNowMoments(input(hijri(1448, 10, 1, 8)));
    expect(main.day).toEqual({kind: 'eidFitr'});
    expect(sceneFor(main, hijri(1448, 10, 1, 8))).toBe('eidfitr');
    // A Ramadan night shows Ramadan, even behind Al-Mulk at bedtime.
    const [night] = bayaanNowMoments(input(hijri(1448, 9, 12, 22)));
    expect(night.kind).toBe('bedtime');
    expect(sceneFor(night, hijri(1448, 9, 12, 22))).toBe('ramadan');
  });
});

describe('the week and the night', () => {
  it('leads with dua in the last hour of Friday, then Al-Kahf', () => {
    expect(ids(input(at(4, 16)))).toEqual(['adhkar:quranic-duas', 'surah:18']);
  });

  it('offers Al-Muzzammil in the last third of the night', () => {
    const [main] = bayaanNowMoments(input(at(1, 3)));
    expect(main).toMatchObject({id: 'surah:73', reason: 'night'});
    expect(sceneFor(main, at(1, 3))).toBe('tahajjud');
  });

  it('picks the scene from the hour', () => {
    const [dawn] = bayaanNowMoments(input(at(0, 5)));
    expect(sceneFor({...dawn, day: undefined}, at(0, 5))).toBe('fajr');
    // A week on, past the white days.
    const [bed] = bayaanNowMoments(input(at(8, 23)));
    expect(sceneFor(bed, at(8, 23))).toBe('bedtime');
    expect(sceneFor(bayaanNowMoments(input(at(4, 8)))[0], at(4, 8))).toBe(
      'kahf',
    );
  });
});
