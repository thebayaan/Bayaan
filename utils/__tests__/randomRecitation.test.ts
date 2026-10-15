import {Reciter, Rewayat} from '@/data/reciterData';
import {pickRandomRecitations} from '../randomRecitation';

function rewayat(id: string, list: number[]): Rewayat {
  return {
    id,
    reciter_id: 'r1',
    name: 'Hafs',
    style: 'murattal',
    server: 's',
    surah_total: list.length,
    surah_list: list,
    source_type: 'r2',
    created_at: 'x',
  };
}

function reciter(id: string, rewayat: Rewayat[]): Reciter {
  return {id, name: id, date: null, image_url: null, rewayat};
}

describe('pickRandomRecitations', () => {
  it('picks a surah and a rewayah that has it for each slot', () => {
    const reciters = [
      reciter('r1', [rewayat('a', [18, 36]), rewayat('b', [36])]),
      reciter('r2', [rewayat('c', [1, 2, 3])]),
    ];
    const picks = pickRandomRecitations(20, reciters);
    expect(picks).toHaveLength(20);
    picks.forEach(pick => {
      const rewayah = pick.reciter.rewayat.find(w => w.id === pick.rewayatId);
      expect(rewayah?.surah_list).toContain(pick.surah.id);
    });
  });

  it('follows the random source', () => {
    const reciters = [
      reciter('r1', [rewayat('a', [18])]),
      reciter('r2', [rewayat('c', [36])]),
    ];
    const last = pickRandomRecitations(1, reciters, () => 0.99);
    expect(last.map(p => [p.reciter.id, p.surah.id])).toEqual([['r2', 36]]);
  });

  it('returns nothing without reciters, and skips a reciter with no rewayat', () => {
    expect(pickRandomRecitations(3, [])).toEqual([]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(pickRandomRecitations(2, [reciter('empty', [])])).toEqual([]);
    warn.mockRestore();
  });
});
