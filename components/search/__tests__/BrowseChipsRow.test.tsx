// RNTL tests for BrowseChipsRow (RFC-020) — the rest-state "Browse" region
// of the Search tab landing.
//
// Mock idiom: inline jest.mock factories, `mock`-prefixed out-of-scope vars,
// no TS annotations inside factory bodies (babel-jest's hoisting transform
// rejects them). expo-router's `push` is spied so the compose-entry deeplink
// (`?openPicker=<dim>`) is pinned; branding drives the declared dimensions;
// reciterStore controls catalog readiness for the toggle counts.

import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import branding from '@/config/branding';
import type {
  SearchFilterDimension,
  SearchFilterFlagFacet,
} from '@/config/branding';
import BrowseChipsRow from '../BrowseChipsRow';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({push: mockPush}),
  useLocalSearchParams: () => ({}),
}));

// Controlled declaration, mutated per test through the mocked module itself
// (a factory can't close over test-file consts — ES imports evaluate before
// the module body, so a captured var would still be undefined at call time).
jest.mock('@/config/branding', () => ({
  __esModule: true,
  default: {searchFilters: []},
}));

let mockCatalogReady = true;
jest.mock('@/store/reciterStore', () => ({
  // @ts-expect-error jest.mock() factory: TS annotations are banned by babel-jest
  useReciterStore: selector => selector({isInitialized: mockCatalogReady}),
}));

// RECITERS carry the generic flag-facet fields + rewayat surah_total (drives
// the full-quran count). full-quran → r1,r3 (=2); featured → r1 (=1);
// curated → r2,r3 (=2).
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
    {
      id: 'r3',
      name: 'Reciter Three',
      rewayat: [{surah_total: 114}],
      curated: true,
    },
  ],
}));

// The hook module (imported for getComposerDimensions) pulls these in at
// load — mocked for isolation/speed (getComposerDimensions itself only reads
// branding, but the imports still evaluate).
jest.mock('@/data/countryCollections', () => ({
  getAllCountries: () => [{id: 'algeria', name: 'Algeria', reciterCount: 3}],
}));
jest.mock('@/data/rewayat', () => ({
  getAllRewayatWithCounts: () => [
    {
      id: 'hafs-an-assem',
      displayName: 'Hafs',
      teacher: 'Asim',
      student: 'Hafs',
      reciterCount: 60,
    },
  ],
}));
jest.mock('@/data/translationCollections', () => ({
  getAllTranslations: () => [{id: 'spanish', name: 'Spanish'}],
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
  mockPush.mockClear();
  mockCatalogReady = true;
  branding.searchFilters = [...FULL_DECLARATION];
});

describe('BrowseChipsRow — rest-state Browse region (RFC-020 §2)', () => {
  it('renders one entry chip per declared dimension, in declaration order', () => {
    const {getByText} = render(<BrowseChipsRow />);

    expect(getByText('Rewaya')).toBeTruthy();
    expect(getByText('Country')).toBeTruthy();
    expect(getByText('Surah')).toBeTruthy();
    expect(getByText('Translation')).toBeTruthy();
    expect(getByText('Full Quran')).toBeTruthy();
    expect(getByText('Featured')).toBeTruthy();
    expect(getByText('Curated')).toBeTruthy();
  });

  it('shows a live reciter count on the toggle dims only (mirrors the composer palette)', () => {
    const {getByText, getAllByText} = render(<BrowseChipsRow />);

    // full-quran (r1,r3) and curated (r2,r3) each resolve to 2; featured
    // (r1) to 1. Value dims (country/rewaya/surah/translation) render no
    // count, so the only count nodes are these three.
    expect(getAllByText('2')).toHaveLength(2);
    expect(getByText('1')).toBeTruthy();
  });

  it('renders no counts until the catalog is ready', () => {
    mockCatalogReady = false;
    const {queryByText} = render(<BrowseChipsRow />);

    // Labels still render; counts are undefined so no count node exists (no
    // chip label contains a bare digit).
    expect(queryByText('Featured')).toBeTruthy();
    expect(queryByText('1')).toBeNull();
    expect(queryByText('2')).toBeNull();
  });

  it('a chip tap deeplinks into the (b.search) composer with openPicker=<dim>', () => {
    const {getByText} = render(<BrowseChipsRow />);

    fireEvent.press(getByText('Rewaya'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/(b.search)/reciter/browse',
      params: {openPicker: 'rewaya'},
    });

    fireEvent.press(getByText('Featured'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(b.search)/reciter/browse',
      params: {openPicker: 'featured'},
    });
  });

  it('renders nothing when branding.searchFilters is unset (stock-upstream no-op)', () => {
    branding.searchFilters = undefined;
    const {toJSON} = render(<BrowseChipsRow />);

    expect(toJSON()).toBeNull();
  });
});
