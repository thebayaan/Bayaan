/**
 * useSearch is a debounce around runSearch; the unit project has no React
 * renderer, so this suite drives runSearch (all of the hook's logic) over the
 * bundled reciter catalogue, the surahs and the adhkar lists, plus the
 * recent-searches store the screen shows before typing.
 */
import fallback from '../../data/reciters-fallback.json';
import {isActiveQuery, isPending, runSearch, searchPane} from './useSearch';
import {createTvSearch, type SearchItem} from '../services/search/tvSearch';
import {normalizeReciters} from '../services/normalizeReciter';
import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
  removeRecentSearch,
} from '../services/searchRecentsStore';
import {storage} from '../services/storage';

const reciters = normalizeReciters(fallback);
const engine = createTvSearch(reciters);

function top(query: string): SearchItem | null {
  return runSearch(engine, query).results.top;
}

function topSurah(query: string): number | null {
  const t = top(query);
  return t?.type === 'surah' ? t.item.id : null;
}

function topReciter(query: string): string | null {
  const t = top(query);
  return t?.type === 'reciter' ? t.item.name : null;
}

function topAdhkar(query: string): string | null {
  const t = top(query);
  return t?.type === 'adhkar' ? t.item.id : null;
}

function topVerse(query: string): string | null {
  const t = top(query);
  return t?.type === 'verse' ? `${t.item.surah.id}:${t.item.ayah}` : null;
}

describe('isActiveQuery', () => {
  it('needs a letter or digit', () => {
    expect(isActiveQuery('')).toBe(false);
    expect(isActiveQuery('  ')).toBe(false);
    expect(isActiveQuery("'-")).toBe(false);
    expect(isActiveQuery('1')).toBe(true);
    expect(isActiveQuery('a')).toBe(true);
  });

  it('is pending only while an active query waits to settle', () => {
    expect(isPending('kahf', '')).toBe(true);
    expect(isPending('kahf', 'kah')).toBe(true);
    // A picked recent settles with the query, so nothing waits.
    expect(isPending('kahf', 'kahf')).toBe(false);
    expect(isPending(' ', '')).toBe(false);
  });

  it('keeps the right side steady while a query settles', () => {
    expect(searchPane('', '', false)).toBe('browse');
    // The first letters from Browse: the tiles stay until results arrive.
    expect(searchPane('k', '', false)).toBe('browse');
    expect(searchPane('kah', 'ka', true)).toBe('results');
    // More letters of a query with no matches: the empty state stays up.
    expect(searchPane('xqz', 'xq', false)).toBe('empty');
    expect(searchPane('xq', 'xq', false)).toBe('empty');
  });

  it('returns no results or suggestions when inactive', () => {
    const {results, suggestions} = runSearch(engine, ' ');
    expect(results.top).toBeNull();
    expect(suggestions).toEqual([]);
  });
});

describe('surahs', () => {
  it.each([
    ['1', 1],
    ['36', 36],
    ['114', 114],
    ['surah 36', 36],
    ['sura 18', 18],
  ])('by number: %s', (query, id) => {
    expect(topSurah(query)).toBe(id);
  });

  it('a number matches only the surah', () => {
    const {results} = runSearch(engine, '36');
    expect(results.reciters).toEqual([]);
    expect(results.adhkar).toEqual([]);
    expect(runSearch(engine, '115').results.top).toBeNull();
  });

  it.each([
    ['al-mulk', 67],
    ['al mulk', 67],
    ['mulk', 67],
    ['al-kahf', 18],
    ['kahf', 18],
    ['alfatiha', 1],
    ['fatiha', 1],
    ['ar-rahman', 55],
    ['rahman', 55],
  ])('by name with or without "al-": %s', (query, id) => {
    expect(topSurah(query)).toBe(id);
  });

  it.each([
    ['fatihha', 1],
    ['baqara', 2],
    ['bqara', 2],
    ['yaseen', 36],
    ['yasin', 36],
    ['kahaf', 18],
    ['mulq', 67],
  ])('misspelt or transliterated: %s', (query, id) => {
    expect(topSurah(query)).toBe(id);
  });

  it.each([
    ['tabarak', 67],
    ['amma', 78],
    ['the cave', 18],
    ['the cow', 2],
    ['الكهف', 18],
  ])('by alias, meaning or Arabic: %s', (query, id) => {
    expect(topSurah(query)).toBe(id);
  });

  it.each([
    ['juz', 78],
    ['juz amma', 78],
    ['جزء عم', 78],
    ['juz 30', 78],
    ['juz30', 78],
    ['جزء ٣٠', 78],
    ['juz 2', 2],
    ['juz 1', 1],
  ])('by juz: %s', (query, id) => {
    expect(topSurah(query)).toBe(id);
  });

  it('lists a juz by number as its surahs in order, never as a verse', () => {
    const {results} = runSearch(engine, 'juz 30');
    expect(results.top?.type).toBe('surah');
    expect(results.surahs.slice(0, 3).map(s => s.id)).toEqual([79, 80, 81]);
    expect(topVerse('juz 30')).toBeNull();
  });

  it('finds nothing for a juz out of range, never a verse of An-Naba', () => {
    expect(top('juz 31')).toBeNull();
    expect(top('juz 0')).toBeNull();
  });

  it('lists more surahs under the top one, without repeating it', () => {
    const {results} = runSearch(engine, 'ash');
    expect(results.top?.type).toBe('surah');
    const topId = results.top?.type === 'surah' ? results.top.item.id : 0;
    expect(results.surahs.length).toBeGreaterThan(0);
    expect(results.surahs.map(s => s.id)).not.toContain(topId);
  });
});

describe('reciters', () => {
  it.each([
    ['alafasi', 'Mishary Alafasi'],
    ['mishary', 'Mishary Alafasi'],
    ['afasy', 'Mishary Alafasi'],
    ['husary', 'Mahmoud Khalil Al-Hussary'],
    ['hosary', 'Mahmoud Khalil Al-Hussary'],
    ['minshawy', 'Mohammed Siddiq Al-Minshawi'],
    ['abdelbaset', 'Abdulbasit Abdulsamad'],
    ['abdul basit', 'Abdulbasit Abdulsamad'],
    ['shatri', 'Shaik Abu Bakr Al Shatri'],
    ['sudais', 'Abdulrahman Alsudaes'],
  ])('%s', (query, name) => {
    expect(topReciter(query)).toBe(name);
  });

  it('puts other reciters in their section', () => {
    const {results} = runSearch(engine, 'yasser');
    expect(results.top?.type).toBe('reciter');
    expect(results.reciters.length).toBeGreaterThan(0);
  });
});

describe('adhkar', () => {
  it.each([
    ['morning', 'morning-adhkar'],
    ['morning adhkar', 'morning-adhkar'],
    ['evening', 'evening-adhkar'],
    ['sleep', 'before-sleep'],
    ['before sleep', 'before-sleep'],
    ['istighfar', 'istighfar'],
    ['sayyid al istighfar', 'istighfar'],
    ['travel', 'travel'],
    ['ruqyah', 'ruqyah-illness'],
    ['أذكار الصباح', 'morning-adhkar'],
    ['salawat', 'salawat'],
  ])('%s', (query, id) => {
    expect(topAdhkar(query)).toBe(id);
  });

  it('finds adhkar by a category title word', () => {
    const {results} = runSearch(engine, 'thunder');
    const ids = [
      ...(results.top?.type === 'adhkar' ? [results.top.item.id] : []),
      ...results.adhkar.map(a => a.id),
    ];
    expect(ids).toContain('nature');
  });

  it.each(['fatiha', 'mish', 'kahf'])(
    'leaves unrelated adhkar out of "%s"',
    query => {
      const {results, suggestions} = runSearch(engine, query);
      expect(results.adhkar).toEqual([]);
      expect(suggestions.map(s => s.kind)).not.toContain('Adhkar');
    },
  );

  it('lists adhkar beside surahs and reciters', () => {
    const {results} = runSearch(engine, 'sh');
    expect(results.adhkar.length).toBeGreaterThan(0);
  });
});

describe('verse references', () => {
  it.each([
    ['2:255', '2:255'],
    ['2 : 255', '2:255'],
    ['2.255', '2:255'],
    ['surah 18:10', '18:10'],
    ['٢:٢٥٥', '2:255'],
    ['ayat al kursi', '2:255'],
    ['ayat al-kursi', '2:255'],
    ['ayatul kursi', '2:255'],
    ['kursi', '2:255'],
    ['آية الكرسي', '2:255'],
    ['kahf 10', '18:10'],
    ['baqarah 255', '2:255'],
  ])('%s', (query, ref) => {
    expect(topVerse(query)).toBe(ref);
  });

  it('names the verse when it has a name', () => {
    const t = top('2:255');
    expect(t?.type === 'verse' && t.item.name).toBe('Ayat al-Kursi');
  });

  it('rejects verses that do not exist', () => {
    expect(topVerse('1:8')).toBeNull();
    expect(topVerse('115:1')).toBeNull();
  });

  it('keeps the surah when its number follows the name', () => {
    expect(topSurah('al-fatihah 1')).toBe(1);
  });

  it('puts the verse surah in the surah section', () => {
    const {results} = runSearch(engine, '2:255');
    expect(results.surahs.map(s => s.id)).toEqual([2]);
  });

  it('leaves An-Nur the surah on top for "light"', () => {
    expect(topSurah('light')).toBe(24);
  });
});

describe('suggestions', () => {
  it('tags each completion and marks the typed part', () => {
    const {suggestions} = runSearch(engine, 'sh');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    const kinds = new Set(suggestions.map(s => s.kind));
    expect(kinds.size).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(['Surah', 'Reciter', 'Adhkar', 'Verse']).toContain(s.kind);
    }
    const sharh = suggestions.find(s => s.label === 'Ash-Sharh');
    if (sharh?.match) {
      expect(sharh.label.slice(...sharh.match).toLowerCase()).toBe('sh');
    }
  });

  it('keeps Ya-Sin among the suggestions while "yas" is typed', () => {
    for (const q of ['ya', 'yas', 'yasi']) {
      const labels = runSearch(engine, q).suggestions.map(s => s.label);
      expect(labels).toContain('Ya-Sin');
    }
  });

  it('suggests the top result first', () => {
    const {suggestions} = runSearch(engine, 'morning');
    expect(suggestions[0]).toMatchObject({kind: 'Adhkar', label: 'Morning'});
  });

  it('suggests a verse with its reference', () => {
    const {suggestions} = runSearch(engine, 'ayat al kursi');
    expect(suggestions[0]).toMatchObject({
      kind: 'Verse',
      label: 'Ayat al-Kursi · 2:255',
      fill: 'Ayat al-Kursi',
    });
  });

  it('never repeats a label', () => {
    const {suggestions} = runSearch(engine, 'a');
    const labels = suggestions.map(s => s.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('searchRecentsStore', () => {
  beforeEach(() => storage.clearAll());

  it('keeps the newest first without duplicates', () => {
    recordSearch('mulk');
    recordSearch('Alafasi');
    recordSearch('MULK');
    expect(getRecentSearches()).toEqual(['MULK', 'Alafasi']);
  });

  it('keeps a one-digit surah number but not a lone letter', () => {
    recordSearch('1');
    recordSearch('a');
    expect(getRecentSearches()).toEqual(['1']);
  });

  it('removes a single recent (case-insensitive) leaving the rest', () => {
    recordSearch('Alafasy');
    recordSearch('Fatihah');
    removeRecentSearch('alafasy');
    expect(getRecentSearches()).toEqual(['Fatihah']);
  });

  it('clearRecentSearches empties the store', () => {
    recordSearch('Fatihah');
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });
});

describe('few letters', () => {
  it('puts Ash-Sharh level with reciters for "sh", surahs first on ties', () => {
    const t = top('sh');
    expect(t?.type).toBe('surah');
  });
});
