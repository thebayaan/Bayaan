import {
  CURATED_ROW_MIN,
  curatedRail,
  curatedRow,
  featuredRow,
  hasReciterChoice,
  homeVoiceCandidates,
  portraitName,
  preferredReciterIds,
  recitersByIds,
} from './homeReciters';
import type {Reciter} from '../types/reciter';

const r = (id: string, featured = false, name = id): Reciter =>
  ({id, name, is_featured: featured, rewayat: []}) as unknown as Reciter;

describe('curatedRow', () => {
  const catalog = [
    r('hus', false, 'Mahmoud Khalil Al-Hussary'),
    r('tun', false, 'Khalifa Altunaiji'),
    r('afs', false, 'Mishary Alafasi'),
  ];
  const names = [
    'Mishary Alafasi',
    'Nobody In The Catalog',
    'Khalifa Al-Tunaiji',
    'Mahmoud Khalil Al-Hussary',
  ];

  it('follows the list order, matching names loosely and skipping unknowns', () => {
    expect(curatedRow(catalog, names, []).map(x => x.id)).toEqual([
      'afs',
      'tun',
      'hus',
    ]);
  });

  it('leaves out reciters the rails above show, and caps', () => {
    expect(curatedRow(catalog, names, ['afs']).map(x => x.id)).toEqual([
      'tun',
      'hus',
    ]);
    expect(curatedRow(catalog, names, [], 1).map(x => x.id)).toEqual(['afs']);
  });

  it('matches a catalog name that holds the listed one', () => {
    const shatri = r('sha', false, 'Shaik Abu Bakr Al Shatri');
    const minshawi = r('min', false, 'Mohammed Siddiq Al-Minshawi');
    expect(
      curatedRow(
        [shatri, minshawi],
        ['Abu Bakr Al-Shatri', 'Mohammed Siddiq Al-Minshawi Muallim'],
        [],
      ).map(x => x.id),
    ).toEqual(['sha', 'min']);
  });
});

describe('curatedRail', () => {
  it('shows the whole list, or nothing when fewer than the minimum', () => {
    const five = ['a1', 'b2', 'c3', 'd4', 'e5'].map(n => r(n, false, n));
    const names = five.map(x => x.name);
    expect(curatedRail(five, names)).toHaveLength(CURATED_ROW_MIN);
    expect(curatedRail(five.slice(0, 4), names)).toEqual([]);
  });

  it('moves voices already shown above to the end', () => {
    const five = ['a1', 'b2', 'c3', 'd4', 'e5'].map(n => r(n, false, n));
    const names = five.map(x => x.name);
    const ids = curatedRail(five, names, [five[0], five[2]]).map(x => x.id);
    expect(ids).toEqual(['b2', 'd4', 'e5', 'a1', 'c3']);
  });
});

describe('portraitName', () => {
  it.each([
    ['Mishary Alafasi', 'Mishary Alafasi'],
    ['Mohammed Jibreel', 'Jibreel'],
    ['Abdulrahman Alsudaes', 'Al-Sudaes'],
    ['Hashim Abu Dalal', 'Abu Dalal'],
    ['Mohammed Osman Khan', 'Osman Khan'],
    ['Mohammed Siddiq Al-Minshawi', 'Al-Minshawi'],
    ['Mahmoud Khalil Al-Hussary', 'Al-Hussary'],
    ['Abdulbasit Abdulsamad', 'Abdulsamad'],
    ['  Saud   Al-Shuraim ', 'Saud Al-Shuraim'],
  ])('%s -> %s', (name, expected) => {
    expect(portraitName(name)).toBe(expected);
  });
});

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
