// @ai-generated
/**
 * ReadingPageView (List view, horizontal pages) in Arabic: the page card,
 * its edge strips and rounded corners are physical book geometry, like the
 * mushaf pages (DKPageView), so the page is laid out left-to-right. Before,
 * it inherited the pager's RTL and the edges of a right-hand page were
 * drawn on its left. The text inside keeps the app's direction.
 */

import React, {act} from 'react';
import {StyleSheet} from 'react-native';
import TestRenderer from 'react-test-renderer';

// The app in Arabic.
jest.mock('@/utils/rtl', () => ({
  ...jest.requireActual('@/utils/rtl'),
  isRTL: true,
  appDirection: 'rtl',
  appLayoutDirection: {direction: 'rtl'},
}));

// jest.mock factories run before this module's top-level code: build the
// verses lazily.
function mockVerses() {
  return Array.from({length: 2}, (_, i) => ({
    verse_key: `2:${i + 1}`,
    surah_number: 2,
    ayah_number: i + 1,
    text: '',
  }));
}

jest.mock('@/components/player/v2/PlayerContent/QuranView/VerseItem', () => ({
  VerseItem: () => null,
}));

jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SurahDivider',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

jest.mock('@/components/mushaf/PageEdgeDecoration', () => ({
  __esModule: true,
  default: () => null,
  EDGE_BORDER_RADIUS: 40,
  EDGE_HORIZONTAL_INSET: 4,
}));

jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react');
  const FlashList = ReactActual.forwardRef(
    (
      props: {
        data: unknown[];
        renderItem: (info: {item: unknown; index: number}) => unknown;
      },
      ref: unknown,
    ) => {
      ReactActual.useImperativeHandle(ref, () => ({
        scrollToIndex: () => undefined,
      }));
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    rewayah: 'hafs',
    getCacheVersion: () => 1,
    // @ai — read by the verse units of a non-Hafs text (useRewayahVerseUnits)
    subscribeCacheChanges: () => () => undefined,
    getRewayahLoadState: () => 'loaded',
    ensureRewayahLoaded: async () => undefined,
    retainRewayah: () => () => undefined,
    // Page 2 holds the slots of the synthetic surah 2 (mergedOpeningUnits).
    getPageLines: (page: number) =>
      page === 2
        ? [
            {
              page_number: 2,
              line_number: 1,
              line_type: 'ayah',
              is_centered: 0,
              first_word_id: 1,
              last_word_id: 23,
              surah_number: '',
            },
          ]
        : [],
  },
}));

jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  // @ai — the shown-units mapping the band of a non-Hafs text goes through
  shownVerseUnitsOf: jest.requireActual(
    '@/services/mushaf/MushafVerseMapService',
  ).shownVerseUnitsOf,
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: (page: number) =>
      page === 2 ? ['2:1', '2:2', '2:3', '2:4', '2:5', '2:6'] : [],
  },
}));

// @ai — a Warsh-like surah 2 (rewayah 2:1 = Hafs 2:1 + 2:2) for the
// rewayah case below; Hafs never asks for units.
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => {
  const {mergedOpeningUnits} = jest.requireActual(
    '@/components/player/v2/PlayerContent/QuranView/__fixtures__/verseUnitsFixtures',
  );
  const warsh = mergedOpeningUnits('warsh');
  return {
    rewayahVerseUnitsService: jest
      .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
      .verseUnitsServiceStub({
        peek: (rewayah: string) => (rewayah === 'warsh' ? warsh : null),
        status: () => 'unavailable',
      }),
  };
});

jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {getThemeForVerse: () => undefined},
}));

jest.mock('@/utils/mushafPageVerses', () => ({
  getReadingPageItems: () => [
    {type: 'surah_header', surahNumber: 2, showBismillah: true},
    ...mockVerses().map(verse => ({type: 'verse', verse})),
  ],
}));

jest.mock('@/utils/enhancedVerseData', () => ({
  get enhancedVersesBySurah() {
    return {2: mockVerses()};
  },
}));

jest.mock('@/utils/translationLookup', () => ({
  getTranslationName: () => 'Translation',
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

// mushafPlayerStore's playback dependencies (not exercised here)
jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

import ReadingPageView from '../ReadingPageView';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(isBookLayout: boolean) {
  act(() => {
    renderer = TestRenderer.create(
      <ReadingPageView
        pageNumber={3}
        textColor="#111111"
        surahLabel=""
        juzLabel=""
        pageLabel=""
        labelColor="#666666"
        borderColor="#cccccc"
        cardColor="#ffffff"
        bgColor="#ffffff"
        isBookLayout={isBookLayout}
        pageSize={{width: 390, height: 844}}
      />,
    );
  });
}

/** The page's outermost host view. */
const rootStyle = () =>
  StyleSheet.flatten(
    renderer!.root.findAll(n => typeof n.type === 'string')[0].props.style,
  );
/** The ScrollView's content container style, as the page passes it. */
const contentStyle = () =>
  StyleSheet.flatten(
    renderer!.root.find(
      n =>
        typeof n.props.onScrollBeginDrag === 'function' &&
        typeof n.instance?.scrollTo === 'function',
    ).props.contentContainerStyle,
  );

beforeEach(() => {
  useMushafSettingsStore.setState({mushafRenderer: 'dk_v2', rewayah: 'hafs'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe.each([
  ['book layout', true],
  ['plain layout', false],
])('%s', (_name, isBookLayout) => {
  it('draws the page in physical (left-to-right) coordinates', () => {
    render(isBookLayout);
    expect(rootStyle().direction).toBe('ltr');
  });

  it("lays the text out in the app's direction", () => {
    render(isBookLayout);
    expect(contentStyle().direction).toBe('rtl');
  });
});
