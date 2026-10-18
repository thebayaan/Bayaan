import {
  featuredRow,
  hasReciterChoice,
  homeVoiceCandidates,
  preferredReciterIds,
  recitersByIds,
} from './homeReciters';
import type {Reciter} from '../types/reciter';

const r = (id: string, featured = false, name = id): Reciter =>
  ({id, name, is_featured: featured, rewayat: []}) as unknown as Reciter;

const all = [r('a'), r('b', true), r('c'), r('d', true), r('e')];

describe('recitersByIds', () => {
  it('keeps the order, skips unknown ids and repeats, and caps', () => {
    expect(
      recitersByIds(['c', 'zzz', 'a', 'c', 'e'], all).map(x => x.id),
    ).toEqual(['c', 'a', 'e']);
    expect(recitersByIds(['c', 'a', 'e'], all, 2).map(x => x.id)).toEqual([
      'c',
      'a',
    ]);
  });

  it('is empty without ids or reciters', () => {
    expect(recitersByIds([], all)).toEqual([]);
    expect(recitersByIds(['a'], [])).toEqual([]);
  });
});

describe('featuredRow', () => {
  it('puts featured reciters first and leaves out the ones already shown', () => {
    expect(featuredRow(all, ['b'], 3).map(x => x.id)).toEqual(['d', 'a', 'c']);
  });

  it('puts the phone list first, by name', () => {
    const minshawi = r('m', false, 'Mohammed Siddiq Al-Minshawi');
    const basfar = r('x', false, 'Albaraa Basfar');
    expect(
      featuredRow([...all, minshawi, basfar], [], 2).map(x => x.id),
    ).toEqual(['x', 'm']);
  });
});

describe('homeVoiceCandidates', () => {
  it('orders the default, favourites, then popular voices, without repeats', () => {
    const afasy = r('af', false, 'Mishary Alafasi');
    const out = homeVoiceCandidates({
      reciters: [...all, afasy],
      first: all[4],
      favoriteIds: ['c', 'e', 'nope'],
    });
    expect(out.slice(0, 3).map(x => x.id)).toEqual(['e', 'c', 'af']);
    expect(new Set(out).size).toBe(out.length);
  });

  it('works before any reciter is chosen', () => {
    const out = homeVoiceCandidates({
      reciters: all,
      first: null,
      favoriteIds: [],
    });
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('preferredReciterIds', () => {
  it('ranks favourites, then the default, then recent, once each', () => {
    expect(
      preferredReciterIds({
        favoriteIds: ['f'],
        defaultId: 'd',
        recentIds: ['r', 'f', 'd'],
      }),
    ).toEqual(['f', 'd', 'r']);
    expect(
      preferredReciterIds({favoriteIds: [], defaultId: null, recentIds: []}),
    ).toEqual([]);
  });
});

describe('hasReciterChoice', () => {
  const withSurahs = (id: string, surahs: number[]): Reciter =>
    ({
      id,
      name: id,
      is_featured: false,
      rewayat: [{id: `${id}-hafs`, name: 'Hafs', surah_list: surahs}],
    }) as unknown as Reciter;

  it('is true when someone recites the surah', () => {
    expect(
      hasReciterChoice([withSurahs('a', [1]), withSurahs('b', [18])], 18),
    ).toBe(true);
  });

  it('is false when nobody does, or there are no reciters yet', () => {
    expect(hasReciterChoice([withSurahs('a', [1])], 18)).toBe(false);
    expect(hasReciterChoice([], 18)).toBe(false);
  });
});
