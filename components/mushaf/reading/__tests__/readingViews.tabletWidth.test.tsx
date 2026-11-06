// @ai-generated
/**
 * On iPad the list and translation views take the pane they are given and
 * keep their text in a centred reading column of at most 680pt. Phones leave
 * the size out, and readingViews.hafsGolden checks they render as before.
 */
import React, {act} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import TestRenderer from 'react-test-renderer';

interface MockFlashListProps {
  data: unknown[];
  renderItem: (info: {item: unknown; index: number}) => React.ReactNode;
  contentContainerStyle?: {paddingHorizontal?: number};
  scrollsToTop?: boolean;
}

const mockRecorded = {
  dividerWidths: [] as number[],
  flashList: null as MockFlashListProps | null,
};

jest.mock('@/components/player/v2/PlayerContent/QuranView/VerseItem', () => ({
  VerseItem: () => null,
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader',
  () => ({__esModule: true, default: () => null}),
);
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SurahDivider',
  () => ({
    __esModule: true,
    default: (props: {width: number}) => {
      mockRecorded.dividerWidths.push(props.width);
      return null;
    },
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
    (props: MockFlashListProps, _ref: unknown) => {
      mockRecorded.flashList = props;
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.data
          .slice(0, 3)
          .map((item: unknown, index: number) =>
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
  useMushafFontMgr: () => null,
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const actual = jest.requireActual(
    '@/services/mushaf/DigitalKhattDataService',
  );
  const {createFakeDKService} = jest.requireActual(
    '@/services/mushaf/__fixtures__/rewayahOverlayFixture',
  );
  const service = createFakeDKService(actual.BASMALLAH_TEXT);
  return {
    ...actual,
    digitalKhattDataService: Object.assign(service, {
      getRewayahLoadState: () => 'loaded',
      ensureRewayahLoaded: async () => undefined,
    }),
  };
});
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: () => null}),
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {getThemeForVerse: () => undefined},
}));
jest.mock('@/utils/translationLookup', () => ({
  ...jest.requireActual('@/utils/translationLookup'),
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

import ContinuousListView from '../ContinuousListView';
import ReadingPageView from '../ReadingPageView';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {moderateScale} from '@/utils/scale';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import {
  fixtureLines,
  fixtureWords,
} from '@/services/mushaf/__fixtures__/verseUnitPages';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const dk = digitalKhattDataService as unknown as FakeDKService;

beforeAll(() => {
  dk.loadData({
    rewayah: 'hafs',
    words: fixtureWords('hafs'),
    lines: fixtureLines(),
  });
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
});

afterAll(() => mushafVerseMapService.clear());

beforeEach(() => {
  mockRecorded.dividerWidths = [];
  mockRecorded.flashList = null;
});

function renderPage(
  pageSize: {width: number; height: number},
  isBookLayout: boolean,
): TestRenderer.ReactTestRenderer {
  let r = {} as TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <ReadingPageView
        pageNumber={1}
        textColor="#111111"
        surahLabel="Al-Fatihah"
        juzLabel="Juz 1"
        pageLabel="1"
        labelColor="#666666"
        borderColor="#cccccc"
        cardColor="#ffffff"
        bgColor="#fafafa"
        isBookLayout={isBookLayout}
        pageSize={pageSize}
      />,
    );
  });
  return r;
}

const flat = (node: TestRenderer.ReactTestInstance) =>
  StyleSheet.flatten(node.props.style) ?? {};

describe('ReadingPageView on iPad', () => {
  it('fills the pager item it is given', () => {
    const r = renderPage({width: 1376, height: 940}, false);
    const page = r.root.findAll(n => (n.type as unknown) === View)[0];
    expect(flat(page)).toMatchObject({width: 1376, height: 940});
  });

  it('keeps the text in a centred 680pt column', () => {
    const r = renderPage({width: 1376, height: 940}, false);
    const scroll = r.root.find(n => (n.type as unknown) === ScrollView);
    expect(scroll.props.contentContainerStyle.paddingHorizontal).toBe(348);
    expect(mockRecorded.dividerWidths[0]).toBe(680);
  });

  it('centres the book card around the column, with four round corners', () => {
    const r = renderPage({width: 1376, height: 940}, true);
    const sheetWidth = 680 + (moderateScale(12) + 4) * 2;
    const sheet = r.root.find(
      n => (n.type as unknown) === View && flat(n).alignSelf === 'center',
    );
    expect(flat(sheet).width).toBeCloseTo(sheetWidth);
    const card = r.root.find(
      n => (n.type as unknown) === View && flat(n).borderRadius === 40,
    );
    expect(flat(card)).toMatchObject({left: 4, right: 4});
    expect(mockRecorded.dividerWidths[0]).toBeCloseTo(680);
  });

  it('uses the whole width of a narrow window', () => {
    const r = renderPage({width: 600, height: 940}, false);
    const scroll = r.root.find(n => (n.type as unknown) === ScrollView);
    expect(scroll.props.contentContainerStyle.paddingHorizontal).toBe(16);
    expect(mockRecorded.dividerWidths[0]).toBe(568);
  });

  it('keeps the page-edge look in a narrow window', () => {
    const r = renderPage({width: 600, height: 940}, true);
    expect(
      r.root.findAll(
        n => (n.type as unknown) === View && flat(n).borderRadius === 40,
      ),
    ).toHaveLength(0);
    expect(mockRecorded.dividerWidths[0]).toBeCloseTo(
      600 - 4 - moderateScale(12) * 2,
    );
  });
});

describe('ContinuousListView on iPad', () => {
  function renderList(width: number, scrollsToTop?: boolean) {
    act(() => {
      TestRenderer.create(
        <ContinuousListView
          textColor="#111111"
          labelColor="#666666"
          borderColor="#cccccc"
          initialPage={1}
          width={width}
          scrollsToTop={scrollsToTop}
        />,
      );
    });
  }

  it('keeps the text in a centred 680pt column', () => {
    renderList(1376);
    expect(
      mockRecorded.flashList?.contentContainerStyle?.paddingHorizontal,
    ).toBe(348);
    expect(mockRecorded.dividerWidths[0]).toBe(680);
  });

  it('keeps its phone padding when the pane is narrower than the column', () => {
    renderList(690);
    expect(
      mockRecorded.flashList?.contentContainerStyle?.paddingHorizontal,
    ).toBe(moderateScale(8));
    expect(mockRecorded.dividerWidths[0]).toBeCloseTo(690 - moderateScale(16));
  });

  it('scrolls to the start on a status bar tap unless told not to', () => {
    renderList(1376);
    expect(mockRecorded.flashList?.scrollsToTop).toBe(true);
    renderList(1376, false);
    expect(mockRecorded.flashList?.scrollsToTop).toBe(false);
  });
});
