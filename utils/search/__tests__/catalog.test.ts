// @ai-generated
import {SURAHS, type Surah} from '@/data/surahData'; // @ai
import {RECITERS, markRecitersUpdated, type Reciter} from '@/data/reciterData';
import reciterData from '@/data/reciters-fallback.json';
import {createCatalogSearch, rankReciters, rankSurahs} from '../catalog';

const reciters: Reciter[] = reciterData;
const ALAFASI = 'b3bca7d8-b004-4511-b46e-f3527f6b1f67';

afterEach(() => {
  RECITERS.splice(0, RECITERS.length);
});

describe('rankSurahs', () => {
  it.each([
    '112',
    '١١٢',
    '۱۱۲',
    ' ١١٢ ',
    '\u200f١١٢\u200f',
    'surah 112',
    'سورة ١١٢',
  ])('treats %s as surah number 112', query => {
    expect(rankSurahs(query).map(s => s.id)).toEqual([112]);
  });

  it.each(['0', '115', '999'])('returns nothing for out-of-range %s', query => {
    expect(rankSurahs(query)).toEqual([]);
  });

  it('returns the input unchanged for an empty query', () => {
    expect(rankSurahs('')).toBe(SURAHS);
    const subset = SURAHS.slice(0, 3);
    expect(rankSurahs('  ', subset)).toBe(subset);
  });

  it('restricts results to the given subset', () => {
    const subset = SURAHS.filter(s => s.id !== 1);
    expect(rankSurahs('fatiha', subset).map(s => s.id)).not.toContain(1);
  });

  it('finds surahs by alias', () => {
    expect(rankSurahs('amma')[0].id).toBe(78);
    expect(rankSurahs('tabarak')[0].id).toBe(67);
  });

  it('keeps original objects for display', () => {
    expect(rankSurahs('ال عمران')[0]).toBe(SURAHS[2]);
  });

  // @ai-start
  it.each([
    ['yasin surah', 36],
    ['kahf surah', 18],
    ['الفاتحة سورة', 1],
    ['36 surah', 36],
    ['surah number 36', 36],
    ['surah no 36', 36],
    ['chapter 36', 36],
    ['سورة رقم ٣٦', 36],
    ['surah e yaseen', 36],
    ['surah-e-rahman', 55],
  ])('ignores the surah word anywhere: %s', (query, id) => {
    expect(rankSurahs(query)[0]?.id).toBe(id);
  });

  it('keeps a trailing link word that may still grow into a name', () => {
    // "surah no" is half of "surah noor", not "surah number".
    expect(rankSurahs('surah no').map(s => s.id)).toContain(71);
  });
  // @ai-end
});

describe('rankReciters', () => {
  it('rebuilds when RECITERS is repopulated in place', () => {
    expect(rankReciters('alafasi')).toEqual([]);
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters('alafasi')[0].id).toBe(ALAFASI);
  });

  it('searches Arabic names and rewayah names', () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters('العفاسي')[0].id).toBe(ALAFASI);
    expect(rankReciters('warsh').length).toBeGreaterThan(0);
  });

  it("returns the caller's own objects from the subset", () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    const persistedCopy = {...reciters.find(r => r.id === ALAFASI)!};
    expect(rankReciters('alafasi', [persistedCopy])[0]).toBe(persistedCopy);
  });

  it('restricts results to the given subset', () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    const subset = reciters.filter(r => r.id !== ALAFASI);
    expect(rankReciters('alafasi', subset).map(r => r.id)).not.toContain(
      ALAFASI,
    );
  });
});

describe('createCatalogSearch (Home)', () => {
  const search = createCatalogSearch(reciters, SURAHS);

  it('merges surahs and reciters by score, best first', () => {
    const results = search.search('al');
    const scores = results.map(r => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('returns only the surah for a number', () => {
    expect(search.search('36')).toEqual([
      {type: 'surah', item: SURAHS[35], score: 100},
    ]);
  });

  // Device QA (2026-10-14): reciter "Al-Qaria Yassen" outranked Ya-Sin.
  it('ranks Ya-Sin first for its common spellings', () => {
    for (const query of ['yaseen', 'yasin', 'ya-seen']) {
      expect(search.search(query)[0]?.item).toBe(SURAHS[35]);
    }
  });

  // @ai-start
  it.each([
    'mishary rashid alafasy',
    'mishary bin rashid alafasy',
    'مشاري راشد العفاسي',
    'mishary rashid',
  ])('allows one word the catalogue lacks when nothing matched: %s', query => {
    expect(search.search(query)[0]?.item.id).toBe(ALAFASI);
  });

  it('keeps the one-missing-word fallback away from real matches', () => {
    // A surah matched, so no reciter named Muhammad is added.
    expect(search.search('surah muhammad').map(r => r.type)).toEqual(['surah']);
    // A loose consonant match alone is not a result.
    expect(search.search('ayat kursi')).toEqual([]);
  });

  it('ranks Ya-Sin first for its Arabic spelling ياسين', () => {
    for (const query of ['ياسين', 'سورة ياسين']) {
      expect(search.search(query)[0]?.item).toBe(SURAHS[35]);
    }
    // Reciters who carry the word are still listed.
    expect(search.search('ياسين').length).toBeGreaterThan(1);
  });

  it.each([
    ['kausar', 108],
    ['zariyat', 51],
    ['dhuha', 93],
    ['mudassir', 74],
    ['inshirah', 94],
    ['jasiya', 45],
    ['takasur', 102],
    ['waqiya', 56],
    ['ambiya', 21],
    ['iqra', 96],
  ])('finds the regional spelling %s', (query, id) => {
    expect((search.search(query)[0]?.item as Surah | undefined)?.id).toBe(id);
  });
  // @ai-end

  // @ai-start
  it.each([
    ['al nur', 24],
    ['al nas', 114],
    ['al tin', 95],
    ['al rum', 30],
    ['al tur', 52],
    ['surah al noor', 24],
  ])('reads "al" as the sounded article: %s', (query, id) => {
    const top = search.search(query)[0];
    expect(top?.type).toBe('surah');
    expect((top?.item as Surah | undefined)?.id).toBe(id);
  });
  // @ai-end
});

// Final-review fixes (2026-10-12).
const HUSSARY = '3aed26b2-eb4a-4daf-be85-34284d37bc57';
const SHURAIM = '6c20bbf9-3c31-43ee-a70f-52ee3b53e098';

function getReciter(id: string): Reciter {
  const reciter = reciters.find(r => r.id === id);
  if (!reciter) throw new Error(`fixture missing ${id}`);
  return reciter;
}

describe('review fixes', () => {
  it('finds a favorite that is missing from RECITERS', () => {
    const favorite = getReciter(ALAFASI);
    RECITERS.splice(
      0,
      RECITERS.length,
      ...reciters.filter(r => r.id !== ALAFASI),
    );
    expect(rankReciters('alafasi', [favorite])).toEqual([favorite]);
  });

  it('searches a subset while RECITERS is still empty', () => {
    const favorite = getReciter(HUSSARY);
    expect(rankReciters('husary', [favorite])).toEqual([favorite]);
  });

  it('rebuilds after an in-place refresh with the same shape', () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters('alafasi')[0].id).toBe(ALAFASI);
    const renamed = reciters.map(r =>
      r.id === ALAFASI ? {...r, name: 'Zzyzx Renamed'} : r,
    );
    RECITERS.splice(0, RECITERS.length, ...renamed);
    markRecitersUpdated();
    expect(rankReciters('zzyzx')[0]?.id).toBe(ALAFASI);
  });

  it.each([
    ['Al-Fatihah (1)', 1],
    ['yasin (36)', 36],
  ])('accepts a surah number next to its name: %s', (query, id) => {
    expect(rankSurahs(query)[0]?.id).toBe(id);
  });

  it.each([
    ['بق', 2],
    ['كه', 18],
  ])('matches short Arabic prefixes after the article: %s', (query, id) => {
    expect(rankSurahs(query)[0]?.id).toBe(id);
  });

  it.each([
    ['عف', ALAFASI],
    ['حص', HUSSARY],
  ])('matches short Arabic reciter prefixes: %s', (query, id) => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters(query)[0]?.id).toBe(id);
  });

  // @ai-start
  it('reciter lists also allow one missing word when nothing matched', () => {
    expect(rankReciters('mishary rashid alafasy', reciters)[0]?.id).toBe(
      ALAFASI,
    );
  });
  // @ai-end

  it('does not fuzz Arabic names on the shared article', () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters('العفاسي').map(r => r.id)).toEqual([ALAFASI]);
  });

  it.each([
    ['hg.lv', 39],
    ['hg;it', 18],
  ])('keyboard fallback keeps punctuation keys for surahs: %s', (query, id) => {
    expect(rankSurahs(query)[0]?.id).toBe(id);
  });

  it('short transliterations do not match loosely', () => {
    expect(rankSurahs('mary').map(s => s.id)).toEqual([19]);
    expect(rankSurahs('qwe')).toEqual([]);
  });

  it('does not match across words with a distant spelling', () => {
    RECITERS.splice(0, RECITERS.length, ...reciters);
    expect(rankReciters('sudais').map(r => r.id)).not.toContain(SHURAIM);
  });
});
