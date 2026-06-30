/**
 * useSearch is a thin debounce wrapper around the pure helpers below. The unit
 * jest project runs in a node environment without a React renderer, so this
 * suite verifies the pure search functions (which carry all the matching
 * logic) and the searchRecentsStore extension. The hook itself is exercised at
 * runtime in the SearchScreen and on-device verification (Phase 4).
 */
import {
  MIN_QUERY_LENGTH,
  normalizeQuery,
  searchReciters,
  searchSurahs,
} from './useSearch';
import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
  removeRecentSearch,
} from '../services/searchRecentsStore';
import {storage} from '../services/storage';
import type {Reciter} from '../types/reciter';

function makeReciter(id: string, name: string): Reciter {
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
    rewayat: [],
  };
}

const RECITERS: Reciter[] = [
  makeReciter('1', 'Mishary Rashid Alafasy'),
  makeReciter('2', 'Abdul Basit Abdul Samad'),
  makeReciter('3', 'Saud Al-Shuraim'),
];

describe('normalizeQuery', () => {
  it('trims and lowercases', () => {
    expect(normalizeQuery('  FaTi  ')).toBe('fati');
  });
});

describe('searchSurahs', () => {
  it('returns Al-Fatihah for "fati"', () => {
    const got = searchSurahs('fati');
    expect(got.some(s => s.name === 'Al-Fatihah')).toBe(true);
  });

  it('matches a surah by its number', () => {
    const got = searchSurahs('114');
    expect(got.some(s => s.id === 114 && s.name === 'An-Nas')).toBe(true);
  });

  it('matches the english translated name', () => {
    const got = searchSurahs('opener');
    expect(got.some(s => s.id === 1)).toBe(true);
  });

  it('returns nothing below the minimum query length', () => {
    expect(searchSurahs('1')).toEqual([]);
    expect(searchSurahs(' ')).toEqual([]);
  });

  it('returns nothing for an unmatched query', () => {
    expect(searchSurahs('zzzzzz')).toEqual([]);
  });
});

describe('searchReciters', () => {
  it('matches a case-insensitive substring of the name', () => {
    expect(searchReciters(RECITERS, 'alafasy').map(r => r.id)).toEqual(['1']);
    expect(searchReciters(RECITERS, 'BASIT').map(r => r.id)).toEqual(['2']);
  });

  it('returns nothing below the minimum query length', () => {
    expect(searchReciters(RECITERS, 'a'.repeat(MIN_QUERY_LENGTH - 1))).toEqual(
      [],
    );
  });

  it('returns nothing for an unmatched query', () => {
    expect(searchReciters(RECITERS, 'qqqq')).toEqual([]);
  });
});

describe('searchRecentsStore.removeRecentSearch', () => {
  beforeEach(() => storage.clearAll());

  it('removes a single recent (case-insensitive) leaving the rest', () => {
    recordSearch('Alafasy');
    recordSearch('Fatihah');
    removeRecentSearch('alafasy');
    expect(getRecentSearches()).toEqual(['Fatihah']);
  });

  it('is a no-op for an entry that is not present', () => {
    recordSearch('Fatihah');
    removeRecentSearch('not-there');
    expect(getRecentSearches()).toEqual(['Fatihah']);
  });

  it('does not write for an empty query', () => {
    recordSearch('Fatihah');
    removeRecentSearch('   ');
    expect(getRecentSearches()).toEqual(['Fatihah']);
  });

  it('clearRecentSearches empties the store', () => {
    recordSearch('Fatihah');
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });
});
