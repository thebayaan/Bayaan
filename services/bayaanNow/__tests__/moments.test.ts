// @ai-generated
import {
  bayaanNowMoments,
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

  it('lets a backend occasion lead', () => {
    const occasion = {
      id: 'occasion:qadr',
      kind: 'playlist' as const,
      playlistId: 'evening-serenity',
      reason: 'occasion' as const,
    };
    expect(ids(input(at(4, 8), {occasion}))[0]).toBe('occasion:qadr');
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
  it('finds the next boundary today, or 4 AM tomorrow', () => {
    expect(nextMomentChange(at(0, 7)).getHours()).toBe(11);
    const late = nextMomentChange(at(0, 22));
    expect(late.getHours()).toBe(4);
    expect(late.getDate()).toBe(24);
  });
});
