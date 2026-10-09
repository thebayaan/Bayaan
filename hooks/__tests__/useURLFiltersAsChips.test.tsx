// RNTL tests for useURLFiltersAsChips (RFC-020) — the URL-as-state core of
// the Search filter composer.
//
// Mock idiom: inline jest.mock factories, `mock`-prefixed out-of-scope vars,
// no TS annotations inside factory bodies (babel-jest's hoisting transform
// rejects them). expo-router is mocked with a captured `setParams` spy + a
// mutable params object so each test controls the URL state directly, pinning
// the locked param-schema contract.

import {renderHook} from '@testing-library/react-native';
import branding from '@/config/branding';
import type {
  SearchFilterDimension,
  SearchFilterFlagFacet,
} from '@/config/branding';
import {useURLFiltersAsChips} from '../useURLFiltersAsChips';

const mockSetParams = jest.fn();
let mockParams: Record<string, string | string[]> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({setParams: mockSetParams}),
  useLocalSearchParams: () => mockParams,
}));

// Controlled declaration, mutated per test through the mocked module
// itself (a factory can't close over test-file consts — ES imports
// evaluate before the module body, so a captured var would still be
// undefined when the factory runs).
jest.mock('@/config/branding', () => ({
  __esModule: true,
  default: {searchFilters: []},
}));

jest.mock('@/store/reciterStore', () => ({
  // @ts-expect-error jest.mock() factory: TS annotations are banned by babel-jest
  useReciterStore: selector => selector({isInitialized: true}),
}));

jest.mock('@/data/countryCollections', () => ({
  getAllCountries: () => [
    {id: 'algeria', name: 'Algeria', reciterCount: 3},
    {id: 'egypt', name: 'Egypt', reciterCount: 5},
  ],
}));

// The composer sources getAllRewayatWithCounts (NOT getAllRewayatTypes,
// which excludes hafs-an-assem by design for the Listen-tab carousel).
// Fixture includes Hafs, a minority narration, and a zero-count entry the
// composer must drop.
jest.mock('@/data/rewayat', () => ({
  getAllRewayatWithCounts: () => [
    {
      id: 'hafs-an-assem',
      name: "Hafs A'n Assem",
      displayName: 'Hafs',
      description: '',
      teacher: 'Asim',
      student: 'Hafs',
      aliases: [],
      reciterCount: 60,
    },
    {
      id: 'warsh-an-nafi',
      name: "Warsh A'n Nafi'",
      displayName: 'Warsh',
      description: '',
      teacher: "Nafi'",
      student: 'Warsh',
      aliases: [],
      reciterCount: 4,
    },
    {
      id: 'qalon-an-nafi',
      name: "Qalon A'n Nafi'",
      displayName: 'Qalun',
      description: '',
      teacher: "Nafi'",
      student: 'Qalun',
      aliases: [],
      reciterCount: 0,
    },
  ],
}));

jest.mock('@/data/translationCollections', () => ({
  getAllTranslations: () => [
    {id: 'spanish', name: 'Spanish', languageCode: 'es', itemCount: 1},
  ],
}));

// Chip order = declaration order. Includes 'has-photo' on purpose — the
// composer must skip it (BrowseReciters' bespoke RFC-012 chip stays the
// owner). The two `{kind:'flag'}` entries exercise the generic flag-facet
// mechanism with tenant-supplied boolean fields.
const FULL_DECLARATION: Array<SearchFilterDimension | SearchFilterFlagFacet> = [
  'rewaya',
  'country',
  'has-surah',
  'translation',
  'full-quran',
  {kind: 'flag', field: 'featured', label: 'Featured'},
  {kind: 'flag', field: 'curated', label: 'Curated'},
  'has-photo',
];

beforeEach(() => {
  mockSetParams.mockClear();
  mockParams = {};
  branding.searchFilters = [...FULL_DECLARATION];
});

describe('useURLFiltersAsChips — params → chips (RFC-020 §3)', () => {
  it('maps URL params to chips in declaration order with labels resolved from the data registries', () => {
    mockParams = {
      country: 'algeria',
      teacher: "Nafi'",
      student: 'Warsh',
      surahId: '2',
      featured: '1',
    };

    const {result} = renderHook(() => useURLFiltersAsChips());

    expect(result.current.activeChips).toEqual([
      {dim: 'rewaya', label: 'Rewaya: Warsh', value: 'warsh-an-nafi'},
      {dim: 'country', label: 'Country: Algeria', value: 'algeria'},
      {dim: 'has-surah', label: 'Surah: Al-Baqarah', value: '2'},
      {dim: 'featured', label: 'Featured', value: '1'},
    ]);
  });

  it('falls back to the display-companion params when the registry cannot resolve a value', () => {
    mockParams = {
      country: 'not-in-registry',
      countryName: 'Somewhere Else',
      translation: 'unknown-lang',
      translationName: 'Klingon',
    };

    const {result} = renderHook(() => useURLFiltersAsChips());

    expect(result.current.activeChips).toEqual([
      {
        dim: 'country',
        label: 'Country: Somewhere Else',
        value: 'not-in-registry',
      },
      {
        dim: 'translation',
        label: 'Translation: Klingon',
        value: 'unknown-lang',
      },
    ]);
  });

  it('full-quran activates only on the locked `fullQuran=1` serialization', () => {
    mockParams = {fullQuran: '1'};
    const {result, rerender} = renderHook(() => useURLFiltersAsChips());
    expect(result.current.activeChips).toEqual([
      {dim: 'full-quran', label: 'Full Quran', value: '1'},
    ]);

    mockParams = {fullQuran: '0'};
    rerender({});
    expect(result.current.activeChips).toEqual([]);
  });

  it('skips a declared has-photo dimension entirely (bespoke BrowseReciters chip stays the owner)', () => {
    mockParams = {hasPhoto: '1'};
    const {result} = renderHook(() => useURLFiltersAsChips());

    expect(result.current.activeChips).toEqual([]);
    expect(result.current.declaredDims.some(d => d.dim === 'has-photo')).toBe(
      false,
    );
    // The rest of the declaration normalizes in order.
    expect(result.current.declaredDims.map(d => d.dim)).toEqual([
      'rewaya',
      'country',
      'has-surah',
      'translation',
      'full-quran',
      'featured',
      'curated',
    ]);
  });

  it('returns no chips and no dims when branding.searchFilters is unset (stock-upstream no-op)', () => {
    branding.searchFilters = undefined;
    mockParams = {country: 'algeria'};

    const {result} = renderHook(() => useURLFiltersAsChips());

    expect(result.current.declaredDims).toEqual([]);
    expect(result.current.activeChips).toEqual([]);
  });
});

describe('useURLFiltersAsChips — setFilter / removeFilter (router.setParams, in place)', () => {
  it('setFilter writes a value dimension as its param + display companion', () => {
    const {result} = renderHook(() => useURLFiltersAsChips());

    result.current.setFilter('country', 'egypt', 'Egypt');
    expect(mockSetParams).toHaveBeenCalledTimes(1);
    expect(mockSetParams).toHaveBeenCalledWith({
      country: 'egypt',
      countryName: 'Egypt',
    });

    result.current.setFilter('translation', 'spanish', 'Spanish');
    expect(mockSetParams).toHaveBeenLastCalledWith({
      translation: 'spanish',
      translationName: 'Spanish',
    });

    result.current.setFilter('has-surah', '2');
    expect(mockSetParams).toHaveBeenLastCalledWith({surahId: '2'});
  });

  it('setFilter resolves a rewaya pick to the locked teacher+student pair + rewayatName companion', () => {
    const {result} = renderHook(() => useURLFiltersAsChips());

    result.current.setFilter('rewaya', 'warsh-an-nafi');

    expect(mockSetParams).toHaveBeenCalledWith({
      teacher: "Nafi'",
      student: 'Warsh',
      rewayatName: 'Warsh',
    });
  });

  it('Hafs is reachable in the rewaya dim — pick resolves and the deeplink label resolves', () => {
    // getAllRewayatTypes() would have excluded hafs-an-assem (carousel
    // diversity), making the majority narration unpickable and degrading its
    // deeplink label; the composer sources getAllRewayatWithCounts.
    mockParams = {teacher: 'Asim', student: 'Hafs'};
    const {result} = renderHook(() => useURLFiltersAsChips());

    expect(result.current.activeChips).toEqual([
      {dim: 'rewaya', label: 'Rewaya: Hafs', value: 'hafs-an-assem'},
    ]);

    result.current.setFilter('rewaya', 'hafs-an-assem');
    expect(mockSetParams).toHaveBeenLastCalledWith({
      teacher: 'Asim',
      student: 'Hafs',
      rewayatName: 'Hafs',
    });
  });

  it('setFilter serializes toggles as <param>=1 (full-quran + generic flag facets)', () => {
    const {result} = renderHook(() => useURLFiltersAsChips());

    result.current.setFilter('full-quran', '1');
    expect(mockSetParams).toHaveBeenLastCalledWith({fullQuran: '1'});

    result.current.setFilter('featured', '1');
    expect(mockSetParams).toHaveBeenLastCalledWith({featured: '1'});

    result.current.setFilter('curated', '1');
    expect(mockSetParams).toHaveBeenLastCalledWith({curated: '1'});
  });

  it('setFilter is single-value per dimension — issues one-key replacements, never appends', () => {
    mockParams = {country: 'algeria', countryName: 'Algeria'};
    const {result, rerender} = renderHook(() => useURLFiltersAsChips());

    result.current.setFilter('country', 'egypt', 'Egypt');

    // Every write for the dim is a scalar replacement of the same keys.
    for (const call of mockSetParams.mock.calls) {
      expect(call[0]).toEqual({country: 'egypt', countryName: 'Egypt'});
      expect(typeof call[0].country).toBe('string');
    }

    // Simulate the router applying the update: still exactly one chip.
    mockParams = {country: 'egypt', countryName: 'Egypt'};
    rerender({});
    const countryChips = result.current.activeChips.filter(
      c => c.dim === 'country',
    );
    expect(countryChips).toEqual([
      {dim: 'country', label: 'Country: Egypt', value: 'egypt'},
    ]);
  });

  it('removeFilter clears a value dimension together with its display companion', () => {
    const {result} = renderHook(() => useURLFiltersAsChips());

    result.current.removeFilter('country');
    expect(mockSetParams).toHaveBeenLastCalledWith({
      country: undefined,
      countryName: undefined,
    });

    result.current.removeFilter('translation');
    expect(mockSetParams).toHaveBeenLastCalledWith({
      translation: undefined,
      translationName: undefined,
    });

    result.current.removeFilter('has-surah');
    expect(mockSetParams).toHaveBeenLastCalledWith({surahId: undefined});
  });

  it('removeFilter for the rewaya dim clears teacher, student, AND rewayatName', () => {
    const {result} = renderHook(() => useURLFiltersAsChips());

    result.current.removeFilter('rewaya');

    expect(mockSetParams).toHaveBeenCalledWith({
      teacher: undefined,
      student: undefined,
      rewayatName: undefined,
    });
  });

  it('flag facets round-trip generically as <field>=1', () => {
    mockParams = {curated: '1'};
    const {result} = renderHook(() => useURLFiltersAsChips());

    expect(result.current.activeChips).toEqual([
      {dim: 'curated', label: 'Curated', value: '1'},
    ]);

    result.current.removeFilter('curated');
    expect(mockSetParams).toHaveBeenLastCalledWith({curated: undefined});
  });

  it('removeFilter clears fullQuran with an explicit undefined', () => {
    const {result} = renderHook(() => useURLFiltersAsChips());

    result.current.removeFilter('full-quran');

    expect(mockSetParams).toHaveBeenLastCalledWith({fullQuran: undefined});
  });
});
