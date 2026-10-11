// RNTL tests for the SearchFilters composer strip (RFC-020).
//
// Mock idiom: inline jest.mock factories with `mock`-prefixed out-of-scope
// vars and no TS annotations inside factory bodies (babel-jest hoisting
// rule). expo-router is mocked (setParams spy + mutable params object);
// react-native-reanimated gets a minimal View + animation-builder stub so
// FilterChip's FadeIn/FadeOut/LinearTransition idiom renders in jsdom.

import React from 'react';
import {Modal} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import branding from '@/config/branding';
import type {
  SearchFilterDimension,
  SearchFilterFlagFacet,
} from '@/config/branding';
import SearchFilters from '../SearchFilters';

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

jest.mock('@/data/reciterData', () => ({
  RECITERS: [
    {
      id: 'r1',
      name: 'Reciter One',
      rewayat: [{surah_total: 114}],
      featured: true,
    },
    {
      id: 'r2',
      name: 'Reciter Two',
      rewayat: [{surah_total: 10}],
      curated: true,
    },
  ],
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
// picker must drop.
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

jest.mock('react-native-size-matters', () => ({
  // @ts-expect-error jest.mock() factory: TS annotations are banned by babel-jest
  moderateScale: v => v,
  // @ts-expect-error jest.mock() factory: TS annotations are banned by babel-jest
  ScaledSheet: {create: s => s},
}));

jest.mock('color', () => {
  const chain = {alpha: () => chain, toString: () => 'rgba(0,0,0,0.2)'};
  return jest.fn(() => chain);
});

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        text: '#000000',
        textSecondary: '#666666',
        card: '#f2f2f2',
        border: '#dddddd',
      },
      fonts: {
        regular: 'Manrope-Regular',
        medium: 'Manrope-Medium',
        semiBold: 'Manrope-SemiBold',
      },
    },
  }),
}));

jest.mock('react-native-reanimated', () => {
  const {View} = require('react-native');
  const mkBuilder = () => {
    const builder = {duration: () => builder};
    return builder;
  };
  return {
    __esModule: true,
    default: {View},
    FadeIn: mkBuilder(),
    FadeOut: mkBuilder(),
    LinearTransition: mkBuilder(),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

const FULL_DECLARATION: Array<SearchFilterDimension | SearchFilterFlagFacet> = [
  'rewaya',
  'country',
  'has-surah',
  'translation',
  'full-quran',
  {kind: 'flag', field: 'featured', label: 'Featured'},
  {kind: 'flag', field: 'curated', label: 'Curated'},
];

beforeEach(() => {
  mockSetParams.mockClear();
  mockParams = {};
  branding.searchFilters = [...FULL_DECLARATION];
});

describe('SearchFilters — composer strip (RFC-020 §2–3)', () => {
  it('renders a removable chip for each active URL param', () => {
    mockParams = {country: 'algeria', countryName: 'Algeria', featured: '1'};

    const {getByText, getByLabelText} = render(<SearchFilters />);

    expect(getByText('Country: Algeria')).toBeTruthy();
    expect(getByText('Featured')).toBeTruthy();
    // Every active chip carries a visible, labelled remove affordance.
    expect(getByLabelText('Remove Country: Algeria filter')).toBeTruthy();
    expect(getByLabelText('Remove Featured filter')).toBeTruthy();
  });

  it('pressing a chip ✕ removes that filter via router.setParams (companions cleared too)', () => {
    mockParams = {country: 'algeria', countryName: 'Algeria'};

    const {getByLabelText} = render(<SearchFilters />);
    fireEvent.press(getByLabelText('Remove Country: Algeria filter'));

    expect(mockSetParams).toHaveBeenCalledWith({
      country: undefined,
      countryName: undefined,
    });
  });

  it('"Add a filter" opens the dimension palette listing only inactive declared dims', () => {
    mockParams = {country: 'algeria', countryName: 'Algeria'};

    const {getByText, queryByText} = render(<SearchFilters />);
    fireEvent.press(getByText('Add a filter'));

    // Active dim is not offered again (single value per dimension).
    expect(queryByText('Country')).toBeNull();
    // Inactive declared dims appear, declaration-ordered.
    expect(getByText('Rewaya')).toBeTruthy();
    expect(getByText('Surah')).toBeTruthy();
    expect(getByText('Translation')).toBeTruthy();
    expect(getByText('Full Quran')).toBeTruthy();
    expect(getByText('Featured')).toBeTruthy();
    expect(getByText('Curated')).toBeTruthy();
  });

  it('picking a flag facet from the palette applies it immediately as <field>=1 (no picker)', () => {
    const {getByText, queryByText} = render(<SearchFilters />);

    fireEvent.press(getByText('Add a filter'));
    fireEvent.press(getByText('Featured'));

    expect(mockSetParams).toHaveBeenCalledWith({featured: '1'});
    // Palette closed after the one-tap apply.
    expect(queryByText('Curated')).toBeNull();
  });

  it('picking a value dim opens its picker; a Hafs pick writes the param pair and closes the sheet', () => {
    const {getByText, queryByText} = render(<SearchFilters />);

    fireEvent.press(getByText('Add a filter'));
    fireEvent.press(getByText('Rewaya'));

    // The picker lists every rewaya with reciters — including Hafs, which
    // getAllRewayatTypes() would have excluded — and drops zero-count rows.
    expect(getByText('Hafs')).toBeTruthy();
    expect(getByText('Warsh')).toBeTruthy();
    expect(queryByText('Qalun')).toBeNull();

    fireEvent.press(getByText('Hafs'));

    expect(mockSetParams).toHaveBeenCalledWith({
      teacher: 'Asim',
      student: 'Hafs',
      rewayatName: 'Hafs',
    });
    expect(queryByText('Hafs')).toBeNull();
  });

  it('palette→picker keeps ONE persistent Modal mounted — visible toggles, content swaps', () => {
    const {getByText, UNSAFE_getByType} = render(<SearchFilters />);

    // Closed: the single persistent Modal instance exists, hidden.
    // UNSAFE_getByType throws if zero or more than one Modal is mounted,
    // so each call below IS the exactly-one assertion.
    expect(UNSAFE_getByType(Modal).props.visible).toBe(false);

    fireEvent.press(getByText('Add a filter'));
    expect(UNSAFE_getByType(Modal).props.visible).toBe(true);

    // Palette → picker: the SAME single Modal stays presented — no
    // dismiss/present pair (the iOS Modal-transition race class) — and
    // only its content swaps to the rewaya picker.
    fireEvent.press(getByText('Rewaya'));
    expect(UNSAFE_getByType(Modal).props.visible).toBe(true);
    expect(getByText('Hafs')).toBeTruthy();

    // Closing hides the same instance (children unmount, Modal persists).
    fireEvent.press(getByText('Hafs'));
    expect(UNSAFE_getByType(Modal).props.visible).toBe(false);
  });

  it('renders nothing when branding.searchFilters is unset (stock-upstream no-op)', () => {
    branding.searchFilters = undefined;
    mockParams = {country: 'algeria'};

    const {toJSON} = render(<SearchFilters />);

    expect(toJSON()).toBeNull();
  });
});

describe('SearchFilters — compose-entry from a Browse-chip deeplink (openPicker)', () => {
  it('an openPicker=<value-dim> deeplink opens that dimension picker on arrival and clears the transient param', () => {
    mockParams = {openPicker: 'rewaya'};

    const {getByText} = render(<SearchFilters />);

    // The rewaya picker is open front-and-center (its options render).
    expect(getByText('Hafs')).toBeTruthy();
    expect(getByText('Warsh')).toBeTruthy();
    // The intent param is cleared so a re-render / shared URL never re-fires.
    expect(mockSetParams).toHaveBeenCalledWith({openPicker: undefined});
  });

  it('an openPicker=<flag-facet> deeplink applies the toggle immediately — no picker', () => {
    mockParams = {openPicker: 'featured'};

    const {queryByText} = render(<SearchFilters />);

    expect(mockSetParams).toHaveBeenCalledWith({openPicker: undefined});
    expect(mockSetParams).toHaveBeenCalledWith({featured: '1'});
    // A toggle has no value to pick — no picker sheet content mounts.
    expect(queryByText('Hafs')).toBeNull();
  });

  it('ignores an unknown openPicker dim — clears the stray param, opens nothing', () => {
    mockParams = {openPicker: 'not-a-dim'};

    const {queryByText} = render(<SearchFilters />);

    expect(mockSetParams).toHaveBeenCalledWith({openPicker: undefined});
    expect(queryByText('Hafs')).toBeNull();
  });
});
