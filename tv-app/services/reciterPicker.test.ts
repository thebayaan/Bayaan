import {defaultReciterChoices, hasCompleteQuran} from './reciterPicker';
import fallback from '../../data/reciters-fallback.json';
import {normalizeReciters} from './normalizeReciter';
import type {Reciter, Rewayah} from '../types/reciter';

function rewayah(id: string, surahs: number[]): Rewayah {
  return {
    id,
    reciter_id: '',
    name: "Hafs A'n Assem",
    style: 'murattal',
    server: 'https://x/',
    source_type: '',
    surah_total: surahs.length,
    surah_list: surahs,
    mp3quran_read_id: null,
    qdc_reciter_id: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  };
}

function reciter(id: string, name: string, surahs: number[]): Reciter {
  return {
    id,
    name,
    name_arabic: null,
    date: '',
    image_url: null,
    bio: null,
    slug: id,
    is_featured: false,
    is_active: true,
    created_at: '',
    updated_at: '',
    rewayat: [rewayah(`${id}1`, surahs)],
  };
}

const all = Array.from({length: 114}, (_, i) => i + 1);

describe('hasCompleteQuran', () => {
  it('needs one recitation with all 114 surahs', () => {
    expect(hasCompleteQuran(reciter('a', 'A', all))).toBe(true);
    expect(hasCompleteQuran(reciter('b', 'B', all.slice(1)))).toBe(false);
  });

  it('ignores null gaps in the surah list', () => {
    const gappy = [...all.slice(1), null] as unknown as number[];
    expect(hasCompleteQuran(reciter('c', 'C', gappy))).toBe(false);
  });
});

describe('defaultReciterChoices', () => {
  const zed = reciter('z', 'Zed', all);
  const amy = reciter('a', 'Amy', all);
  const partial = reciter('p', 'Partial', [1, 2, 3]);
  const sudais = reciter('s', 'Abdulrahman Alsudaes', all);
  const afasy = reciter('f', 'Mishary Alafasi', all);

  it('puts the current pick first, then popular voices, then A to Z', () => {
    const list = defaultReciterChoices([zed, amy, sudais, afasy], 'z', 2);
    expect(list.map(r => r.id)).toEqual(['z', 'f', 's', 'a']);
  });

  it('leads with popular voices when nothing is picked yet', () => {
    const list = defaultReciterChoices([zed, amy, sudais, afasy], null, 2);
    expect(list.map(r => r.id)).toEqual(['f', 's', 'a', 'z']);
  });

  it('leaves out reciters without the whole Quran', () => {
    const list = defaultReciterChoices([zed, partial, amy], null, 0);
    expect(list.map(r => r.id)).toEqual(['a', 'z']);
  });

  it('keeps an incomplete current pick so it still shows as selected', () => {
    const list = defaultReciterChoices([zed, partial], 'p', 0);
    expect(list.map(r => r.id)).toEqual(['p', 'z']);
  });

  it('never repeats a reciter', () => {
    const list = defaultReciterChoices([zed, amy, sudais, afasy], 'f');
    expect(new Set(list.map(r => r.id)).size).toBe(list.length);
  });

  it('offers the whole bundled catalog, not the first few names', () => {
    const catalog = normalizeReciters(fallback);
    const list = defaultReciterChoices(catalog, null);
    const complete = catalog.filter(hasCompleteQuran);
    expect(list).toHaveLength(complete.length);
    expect(list.length).toBeGreaterThan(80);
    expect(list.some(r => /alafas/i.test(r.name))).toBe(true);
  });
});
