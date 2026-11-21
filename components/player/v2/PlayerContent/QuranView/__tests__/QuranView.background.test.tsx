// @ai-generated
/**
 * Player verse list (QuranView) in the background (#540): a track change
 * there leaves the list on the surah it shows, and the return shows the
 * current surah. On Android the view updates made in the background wait for
 * the first frame on return. A second track change there disposed the Skia
 * verse text of the first before its views were made, and the return threw
 * "Attempted to access a disposed object".
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface VerseItemProps {
  verse: {verse_key: string};
}

const mockVerseItems: VerseItemProps[] = [];
const mockTrack = {rewayah: 'hafs'};
const mockHeaderFonts: string[] = [];
const mockHeaderProps: object[] = [];

jest.mock('../VerseItem', () => ({
  VerseItem: (props: VerseItemProps) => {
    mockVerseItems.push(props);
    return null;
  },
}));

jest.mock('../BasmalaHeader', () => ({
  __esModule: true,
  default: (props: {
    dkFontFamily: string;
    rewayah?: string; // @ai
    surahNumber?: number; // @ai
    isActive?: boolean; // @ai
  }) => {
    mockHeaderFonts.push(props.dkFontFamily);
    mockHeaderProps.push(props); // @ai
    return null;
  },
}));

jest.mock('../SurahDivider', () => ({
  __esModule: true,
  default: () => null,
  computeDividerTotalHeight: () => 0,
}));

jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react');
  const FlashList = ReactActual.forwardRef(
    (
      props: {
        data: unknown[];
        renderItem: (info: {item: unknown; index: number}) => unknown;
        ListHeaderComponent?: unknown;
      },
      ref: unknown,
    ) => {
      ReactActual.useImperativeHandle(ref, () => ({
        scrollToIndex: () => undefined,
        scrollToOffset: () => undefined,
      }));
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.ListHeaderComponent,
        props.data.map((item: unknown, index: number) =>
          ReactActual.createElement(
            ReactActual.Fragment,
            {key: index},
            props.renderItem({item, index}),
          ),
        ),
      );
    },
  );
  return {FlashList};
});

jest.mock('@gorhom/bottom-sheet', () => ({
  useBottomSheetScrollableCreator: () => undefined,
}));

jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', border: '#cccccc', card: '#ffffff'},
    },
    isDarkMode: false,
  }),
}));

jest.mock('@/hooks/useReadingThemeColors', () => ({
  useReadingThemeColors: () => ({
    text: '#111111',
    textSecondary: '#666666',
    background: '#ffffff',
  }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));

jest.mock('@/hooks/useCurrentTrackRewayah', () => ({
  useCurrentTrackRewayah: () => mockTrack.rewayah,
}));

// A rewayah track lists its own verses: a surah 2 that merges Hafs 2:1 and
// 2:2 into its verse 2:1 and numbers the rest one lower (like Warsh). @ai
jest.mock('@/hooks/useRewayahVerseUnits', () => {
  const {mergedOpeningUnits} = jest.requireActual(
    '../__fixtures__/verseUnitsFixtures',
  );
  const cache = new Map();
  return {
    useRewayahVerseUnits: (rewayah: string | null) => {
      if (!rewayah) return {units: null, status: 'unavailable'};
      if (!cache.has(rewayah)) cache.set(rewayah, mergedOpeningUnits(rewayah));
      return {units: cache.get(rewayah), status: 'ready'};
    },
  };
});

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {initialized: true},
}));

jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      loadAnnotationsForSurah: () => undefined,
    })),
  };
});

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useTajweedStore: create(() => ({indexedTajweedData: null}))};
});

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({queue: {tracks: [], currentIndex: 0}})),
  };
});

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));

jest.mock('@/utils/translationLookup', () => ({
  getTranslationName: () => 'Translation',
}));

jest.mock('@/config/branding', () => ({__esModule: true, default: {}}));

jest.mock('@/utils/enhancedVerseData', () => {
  const surah = (n: number, count: number) =>
    Array.from({length: count}, (_, i) => ({
      verse_key: `${n}:${i + 1}`,
      surah_number: n,
      ayah_number: i + 1,
      text: '',
    }));
  return {
    enhancedVersesBySurah: {105: surah(105, 5), 106: surah(106, 4)},
    rebuildEnhancedVerses: async () => false,
  };
});

const mockForeground = {value: true, listeners: new Set<() => void>()};
jest.mock('@/hooks/useAppForeground', () => {
  const {useSyncExternalStore} = jest.requireActual('react');
  return {
    useAppForeground: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockForeground.listeners.add(listener);
          return () => mockForeground.listeners.delete(listener);
        },
        () => mockForeground.value,
      ),
  };
});

import {QuranView} from '../index';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function view(surah: number) {
  return (
    <QuranView
      currentSurah={surah}
      onVersePress={() => undefined}
      transliterationFontSize={14}
      translationFontSize={14}
      arabicFontSize={24}
    />
  );
}

/** The verse keys of the latest rows the list rendered. */
function shownSurahs(): number[] {
  const surahs = mockVerseItems.map(p =>
    Number(p.verse.verse_key.split(':')[0]),
  );
  return [...new Set(surahs)];
}

function setForeground(value: boolean) {
  act(() => {
    mockForeground.value = value;
    mockForeground.listeners.forEach(listener => listener());
  });
}

beforeEach(() => {
  mockVerseItems.length = 0;
  mockForeground.value = true;
  useMushafSettingsStore.setState({mushafRenderer: 'dk_v2', rewayah: 'hafs'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('keeps the shown surah while the app is in the background', () => {
  act(() => {
    renderer = TestRenderer.create(view(105));
  });
  setForeground(false);
  mockVerseItems.length = 0;

  // Two track changes in the background build no rows of a new surah.
  act(() => renderer?.update(view(106)));
  act(() => renderer?.update(view(105)));
  act(() => renderer?.update(view(106)));
  expect(shownSurahs()).not.toContain(106);

  // The return shows the current surah.
  setForeground(true);
  expect(shownSurahs()).toContain(106);
});

it('follows the track at once in the foreground', () => {
  act(() => {
    renderer = TestRenderer.create(view(105));
  });
  mockVerseItems.length = 0;
  act(() => renderer?.update(view(106)));
  expect(shownSurahs()).toEqual([106]);
});
