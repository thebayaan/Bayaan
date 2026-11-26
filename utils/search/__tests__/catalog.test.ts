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

  it('lists no reciters for a bare surah word', () => {
    for (const query of ['sura', 'surah', 'سورة']) {
      expect(search.search(query).filter(r => r.type === 'reciter')).toEqual(
        [],
      );
    }
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

  // @ai-start
  // Review: the first letters of a name ("ad" for Adel, "ash" for Al-Hashr)
  // are also article spellings; while typed they must not match every
  // "Al-" name in the catalogue.
  it.each(['ad', 'ar', 'ash', 'ul'])(
    'does not read the word being typed as an article: %s',
    query => {
      expect(search.search(query).length).toBeLessThan(40);
    },
  );

  it.each([
    ['ad', 'Adh-Dhariyat', 5],
    ['ad', 'Adel Al-Khalbany', 8],
    ['ar', 'Abdulmajeed Al-Arkani', 8],
    ['an', 'Anas Alemadi', 12],
    ['ash', 'Al-Hashr', 8],
  ])('keeps a name spelled with "%s" near the top: %s', (query, name, max) => {
    const names = search.search(query).map(r => r.item.name);
    expect(names.indexOf(name)).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(name)).toBeLessThan(max);
  });

  it.each([
    'al qari',
    'al imam',
    'al sheikh',
    // A doubled vowel folds to the same article.
    'aal qari',
    'aal imam',
    'aal sheikh',
  ])(
    'does not list every "Al" reciter for an article plus a title: %s',
    query => {
      expect(search.search(query).length).toBeLessThan(40);
      expect(rankReciters(query, reciters).length).toBeLessThan(40);
    },
  );

  it.each(['al qari', 'aal qari'])(
    'keeps Al-Qari\'ah and Al-Qaria Yassen near the top of "%s"',
    query => {
      const names = search
        .search(query)
        .slice(0, 3)
        .map(r => r.item.name);
      expect(names).toEqual(
        expect.arrayContaining(["Al-Qari'ah", 'Al-Qaria Yassen']),
      );
    },
  );
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

// Regression review of the article, folding and one-missing-word changes.
describe('typed articles and the one-missing-word fallback', () => {
  const home = createCatalogSearch(reciters, SURAHS);
  const names = (query: string, within: readonly Reciter[] = reciters) =>
    rankReciters(query, within).map(r => r.name);

  // Every rewayah name joins reader and teacher with "A'n" ("from"), which
  // is keyed "an" like the article.
  it('does not read the rewayah word "A\'n" as an article', () => {
    expect(home.search('abdulrahman al s')[0]?.item.name).toBe(
      'Abdulrahman Alsudaes',
    );
    const pair = reciters.filter(r =>
      ['Saidin Abdulrahman', 'Abdulrahman Alsudaes'].includes(r.name),
    );
    expect(names('abdulrahman al s', pair)).toEqual(['Abdulrahman Alsudaes']);
    // Not even before a word that starts the teacher's name ("Assem").
    expect(names('abdulrahman al a', pair)).toEqual(['Abdulrahman Alsudaes']);
    // A name without an article is not listed for "el" plus a letter.
    expect(names('el m')).not.toContain('Mohammad Abdullkarem');
    expect(names('el m').length).toBeLessThan(reciters.length);
  });

  it.each([
    ['as', 'Tawfeeq As-Sayegh'],
    ['ar', 'Abdulmajeed Al-Arkani'],
  ])('lists a name with the article "%s" as typed first', (query, name) => {
    expect(names(query)[0]).toBe(name);
  });

  it('keeps the name spelled as typed near the top of a two-word query', () => {
    expect(names('as sa').slice(0, 2)).toContain('Tawfeeq As-Sayegh');
    expect(names('as s').slice(0, 2)).toContain('Tawfeeq As-Sayegh');
    // The "Al" of Al-Airawy does not pair with his rewayah's "Tariq".
    expect(names('at tariq')[0]).toBe('Tareq Abdulgani daawob');
    // Only names whose article comes before an "s" word.
    expect(names('ash s')).not.toContain('Mohammed Siddiq Al-Minshawi');
  });

  it('does not take a doubled-vowel article for a matched word: aal imran', () => {
    expect(names('aal imran')).toEqual([]);
    const top = home.search('aal imran')[0];
    expect(top?.type).toBe('surah');
    expect((top?.item as Surah | undefined)?.id).toBe(3);
  });
});
