/**
 * Search in the reciter pickers (favourite reciters, Mushaf playback). Every
 * rewayah name joins reader and teacher with "A'n" ("from"), keyed "an" like
 * the article. Read as an article, it let "el a" list nearly every reciter
 * through the "A'n Assem" of his rewayah.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import reciterData from '@/data/reciters-fallback.json';
import {RECITERS, type Reciter} from '@/data/reciterData';
import type {AvailableReciter} from '@/store/mushafPlayerStore';

let mockListed: {name: string}[] = [];
let mockType: (query: string) => void = () => undefined;
let mockAvailable: AvailableReciter[] = [];

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {hide: jest.fn()},
}));
jest.mock('@/components/sheets/SheetGestures', () => ({
  SheetFlatList: ({data}: {data: {name: string}[]}) => {
    mockListed = data;
    return null;
  },
}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('@/components/SearchInput', () => ({
  SearchInput: ({onChangeText}: {onChangeText: (query: string) => void}) => {
    mockType = onChangeText;
    return null;
  },
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#000000', textSecondary: '#666666', background: '#fff'},
    },
  }),
}));
jest.mock('@/hooks/useFavoriteReciters', () => ({
  useFavoriteReciters: () => ({
    toggleFavorite: jest.fn(),
    favoriteReciters: [],
  }),
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: Object.assign(
    (
      select: (state: {
        availableReciters: AvailableReciter[];
        recentRewayatIds: string[];
      }) => unknown,
    ) => select({availableReciters: mockAvailable, recentRewayatIds: []}), // @ai
    {getState: () => ({computeAvailableReciters: jest.fn()})},
  ),
}));
jest.mock('../sheetLabels', () => ({getStyleLabel: (style: string) => style}));

import {FavoriteRecitersSheet} from '../FavoriteRecitersSheet';
import {MushafReciterPickerSheet} from '../MushafReciterPickerSheet';

const reciters = reciterData as Reciter[];

beforeAll(() => {
  RECITERS.splice(0, RECITERS.length, ...reciters);
  mockAvailable = reciters.flatMap(reciter =>
    reciter.rewayat.map(rewayah => ({
      rewayatId: rewayah.id,
      reciterId: reciter.id,
      reciterName: reciter.name,
      imageUrl: reciter.image_url,
      rewayahName: rewayah.name,
      style: rewayah.style,
    })),
  );
});

function listedFor(sheet: React.JSX.Element, query: string): string[] {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(sheet);
  });
  act(() => {
    mockType(query);
  });
  const names = mockListed.map(item => item.name);
  act(() => {
    renderer.unmount();
  });
  return names;
}

type FavoriteProps = React.ComponentProps<typeof FavoriteRecitersSheet>;
type MushafProps = React.ComponentProps<typeof MushafReciterPickerSheet>;

describe.each([
  [
    'favourite reciters',
    () => (
      <FavoriteRecitersSheet
        {...({sheetId: 'favorite-reciters'} as FavoriteProps)}
      />
    ),
  ],
  [
    'Mushaf reciter',
    () => (
      <MushafReciterPickerSheet
        {...({sheetId: 'mushaf-reciter-picker'} as MushafProps)}
      />
    ),
  ],
])('the %s picker', (_label, sheet) => {
  it('does not read the rewayah word "A\'n" as an article', () => {
    const listed = listedFor(sheet(), 'el a');
    // His only "a" word after an article-like word is "A'n Assem".
    expect(listed).not.toContain('Saidin Abdulrahman');
    expect(listed).toContain('Ahmad Al-Ajmy');
    expect(listed.length).toBeLessThan(40);
  });

  it('still finds a reciter by his rewayah', () => {
    expect(listedFor(sheet(), 'hafs an assem')).toContain('Saidin Abdulrahman');
    expect(listedFor(sheet(), 'warsh an nafi')).toContain('Mohammad Al-Airawy');
  });
});
