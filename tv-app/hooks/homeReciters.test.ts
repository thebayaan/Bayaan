import {pickHomeReciters} from './homeReciters';
import type {Reciter} from '../types/reciter';

const r = (id: string, featured = false): Reciter =>
  ({id, name: id, is_featured: featured, rewayat: []}) as unknown as Reciter;

const all = [r('a'), r('b', true), r('c'), r('d', true), r('e')];

describe('pickHomeReciters', () => {
  it('orders favourites, recents, default, then featured, without repeats', () => {
    const out = pickHomeReciters({
      reciters: all,
      favoriteIds: ['c'],
      recentIds: ['c', 'e'],
      defaultId: 'a',
      limit: 5,
    });
    expect(out.reciters.map(x => x.id)).toEqual(['c', 'e', 'a', 'b', 'd']);
    expect(out.personal).toBe(true);
    expect(out.title).toBe('Your reciters');
  });

  it('starts with the default and featured reciters on first launch', () => {
    const out = pickHomeReciters({
      reciters: all,
      favoriteIds: [],
      recentIds: [],
      defaultId: 'e',
      limit: 3,
    });
    expect(out.reciters.map(x => x.id)).toEqual(['e', 'b', 'd']);
    expect(out.personal).toBe(false);
  });

  it('skips ids it does not know and respects the limit', () => {
    const out = pickHomeReciters({
      reciters: all,
      favoriteIds: ['zzz'],
      recentIds: [],
      defaultId: null,
      limit: 2,
    });
    expect(out.reciters.map(x => x.id)).toEqual(['b', 'd']);
    expect(out.personal).toBe(false);
  });

  it('is empty when there are no reciters yet', () => {
    expect(
      pickHomeReciters({
        reciters: [],
        favoriteIds: ['a'],
        recentIds: [],
        defaultId: 'a',
      }).reciters,
    ).toEqual([]);
  });
});
