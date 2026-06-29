import {
  normalizeReciter,
  normalizeReciters,
  normalizeRewayah,
  slugify,
} from './normalizeReciter';

describe('slugify', () => {
  it('lowercases and hyphenates names', () => {
    expect(slugify('Abdul Basit')).toBe('abdul-basit');
    expect(slugify('Al-Fatihah')).toBe('al-fatihah');
    expect(slugify("Warsh A'n Nafi'")).toBe('warsh-a-n-nafi');
  });

  it('collapses whitespace and trims separators', () => {
    expect(slugify('  Sheikh   Sudais  ')).toBe('sheikh-sudais');
  });
});

describe('normalizeRewayah', () => {
  it('coerces numeric mp3quran/qdc ids to strings', () => {
    const result = normalizeRewayah({
      id: 'w1',
      reciter_id: 'r1',
      name: 'Hafs',
      style: 'murattal',
      server: 'https://x/',
      source_type: 'mp3quran',
      surah_total: 1,
      surah_list: [1],
      created_at: '2025',
      mp3quran_read_id: 49,
      qdc_reciter_id: 7,
    });
    expect(result.mp3quran_read_id).toBe('49');
    expect(result.qdc_reciter_id).toBe('7');
    expect(result.is_active).toBe(true);
    expect(result.updated_at).toBe('');
  });

  it('defaults missing ids to null', () => {
    const result = normalizeRewayah({
      id: 'w2',
      reciter_id: 'r1',
      name: 'Warsh',
      style: 'murattal',
      server: 'https://x/',
      source_type: 'mp3quran',
      surah_total: 0,
      surah_list: [],
      created_at: '2025',
    });
    expect(result.mp3quran_read_id).toBeNull();
    expect(result.qdc_reciter_id).toBeNull();
  });
});

describe('normalizeReciter', () => {
  it('fills evolved Reciter fields from a raw fallback record', () => {
    const result = normalizeReciter({
      id: 'r1',
      name: 'Abdul Basit',
      date: '2023-11-05T18:22:23+00:00',
      image_url: null,
      rewayat: [
        {
          id: 'w1',
          reciter_id: 'r1',
          name: 'Hafs',
          style: 'murattal',
          server: 'https://x/',
          source_type: 'mp3quran',
          surah_total: 1,
          surah_list: [1],
          created_at: '2025',
          mp3quran_read_id: 49,
          qdc_reciter_id: null,
        },
      ],
    });
    expect(result.slug).toBe('abdul-basit');
    expect(result.is_active).toBe(true);
    expect(result.is_featured).toBe(false);
    expect(result.name_arabic).toBeNull();
    expect(result.bio).toBeNull();
    expect(result.created_at).toBe('');
    expect(result.updated_at).toBe('');
    expect(result.rewayat[0].mp3quran_read_id).toBe('49');
    expect(result.rewayat[0].qdc_reciter_id).toBeNull();
  });

  it('preserves existing created_at/updated_at and image_url when present', () => {
    const result = normalizeReciter({
      id: 'r2',
      name: 'Test',
      date: '2023',
      image_url: 'https://img',
      created_at: '2024-01-01',
      updated_at: '2024-02-02',
      rewayat: [],
    });
    expect(result.created_at).toBe('2024-01-01');
    expect(result.updated_at).toBe('2024-02-02');
    expect(result.image_url).toBe('https://img');
  });
});

describe('normalizeReciters', () => {
  it('maps an array of raw records to fully-formed Reciter[]', () => {
    const result = normalizeReciters([
      {id: 'r1', name: 'One', date: '2023', image_url: null, rewayat: []},
      {id: 'r2', name: 'Two', date: '2023', image_url: null, rewayat: []},
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe('one');
    expect(result[1].is_active).toBe(true);
  });

  it('returns an empty array for non-array input', () => {
    expect(normalizeReciters(null)).toEqual([]);
    expect(normalizeReciters(undefined)).toEqual([]);
    expect(normalizeReciters('nope')).toEqual([]);
  });

  it('skips malformed records that lack a usable id', () => {
    const result = normalizeReciters([
      {name: 'No id', rewayat: []},
      {id: 'ok', name: 'Has id', rewayat: []},
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ok');
  });
});
