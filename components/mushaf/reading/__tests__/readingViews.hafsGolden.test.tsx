// @ai-generated
/**
 * Hafs is unchanged in the mushaf's list and reading modes: ContinuousListView
 * and ReadingPageView render exactly what they rendered before verse units
 * (decision 3), recorded from the previous code in
 * __fixtures__/readingViewsHafs.golden.json: every row and header with all
 * its props (the verse objects, translations, follow-along state, fonts),
 * the list's initial index, its scroll targets and page reports. Hafs never
 * asks for verse units.
 *
 * Regenerate only from the code before verse units:
 *   UPDATE_HAFS_GOLDEN=1 npx jest readingViews.hafsGolden --watchAll=false
 */
import * as fs from 'fs';
import * as path from 'path';
import {createHash} from 'crypto';
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface MockFlashListProps {
  data: unknown[];
  initialScrollIndex?: number;
  renderItem: (info: {item: unknown; index: number}) => React.ReactNode;
  onViewableItemsChanged?: (info: {viewableItems: {item: unknown}[]}) => void;
}

const mockRecorded = {
  calls: [] as [string, unknown][],
  flashList: null as MockFlashListProps | null,
  unitsAsked: [] as string[],
};

jest.mock('@/components/player/v2/PlayerContent/QuranView/VerseItem', () => ({
  VerseItem: (props: object) => {
    mockRecorded.calls.push(['VerseItem', props]);
    return null;
  },
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader',
  () => ({
    __esModule: true,
    default: (props: object) => {
      mockRecorded.calls.push(['BasmalaHeader', props]);
      return null;
    },
  }),
);
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SurahDivider',
  () => ({
    __esModule: true,
    default: (props: object) => {
      mockRecorded.calls.push(['SurahDivider', props]);
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
    (props: MockFlashListProps, ref: unknown) => {
      mockRecorded.flashList = props;
      ReactActual.useImperativeHandle(ref, () => ({
        scrollToIndex: (args: object) => {
          mockRecorded.calls.push(['scrollToIndex', args]);
        },
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
    .verseUnitsServiceStub({
      peek: (rewayah: string) => {
        mockRecorded.unitsAsked.push(rewayah);
        return null;
      },
    }),
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {
    getThemeForVerse: (key: string) => {
      mockRecorded.calls.push(['getThemeForVerse', key]);
      const ayah = Number(key.split(':')[1]);
      return ayah % 3 === 0 ? undefined : {themeIndex: ayah % 2};
    },
  },
}));
jest.mock('@/utils/translationLookup', () => ({
  ...jest.requireActual('@/utils/translationLookup'),
  getTranslationName: () => 'Translation',
}));
jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      loadAnnotationsForSurah: (surah: number) => {
        mockRecorded.calls.push(['loadAnnotationsForSurah', surah]);
      },
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

import ContinuousListView, {
  type ContinuousListViewHandle,
} from '../ContinuousListView';
import ReadingPageView from '../ReadingPageView';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import {
  fixtureLines,
  fixtureWords,
} from '@/services/mushaf/__fixtures__/verseUnitPages';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const GOLDEN = path.join(
  __dirname,
  '../__fixtures__/readingViewsHafs.golden.json',
);
const UPDATE = process.env.UPDATE_HAFS_GOLDEN === '1';

const dk = digitalKhattDataService as unknown as FakeDKService;
// The fixture's Hafs slots: the real page 1 and one page per other surah
// (moved from 1000 + surah to 300 + surah, inside the 604 pages).
const LINES = fixtureLines().map(line =>
  line.page_number === 1
    ? line
    : {...line, page_number: line.page_number - 700},
);

/** Everything recorded since the last take, as JSON (functions named). */
function take(): {count: number; sha256: string; head: unknown[]} {
  const calls = mockRecorded.calls.splice(0);
  const json = JSON.stringify(calls, (_key, value) =>
    typeof value === 'function' ? '[function]' : value,
  );
  return {
    count: calls.length,
    sha256: createHash('sha256').update(json).digest('hex'),
    head: JSON.parse(json).slice(0, 4),
  };
}

function playback(state: object) {
  act(() => {
    useMushafPlayerStore.setState(state);
  });
}

const PLAYING_1_7 = {
  playbackState: 'playing',
  currentVerseKey: '1:7',
  currentVerseKeys: ['1:7'],
};
const PLAYING_71 = {
  playbackState: 'playing',
  currentVerseKey: '71:2',
  currentVerseKeys: ['71:2', '71:3'],
};

/** Every scenario, in order; each step records what was rendered. */
function runScenarios(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const listRef = React.createRef<ContinuousListViewHandle>();
  let renderer: TestRenderer.ReactTestRenderer | null = null;

  const readingPage = (page: number) => (
    <ReadingPageView
      pageNumber={page}
      textColor="#111111"
      surahLabel="Al-Fatihah"
      juzLabel="Juz 1"
      pageLabel={String(page)}
      labelColor="#666666"
      borderColor="#cccccc"
      cardColor="#ffffff"
      bgColor="#fafafa"
      isBookLayout={page % 2 === 0}
    />
  );
  for (const [page, themes] of [
    [1, false],
    [371, true],
    [403, false],
  ] as const) {
    useMushafSettingsStore.setState({showThemes: themes});
    act(() => {
      renderer = TestRenderer.create(readingPage(page));
    });
    out[`reading ${page} idle`] = take();
    playback(page === 1 ? PLAYING_1_7 : PLAYING_71);
    out[`reading ${page} playing`] = take();
    playback({playbackState: 'paused'});
    out[`reading ${page} paused`] = take();
    playback({
      playbackState: 'idle',
      currentVerseKey: null,
      currentVerseKeys: [],
    });
    act(() => renderer?.unmount());
    take();
  }

  useMushafSettingsStore.setState({showThemes: false});
  for (const initialPage of [1, 371]) {
    act(() => {
      renderer = TestRenderer.create(
        <ContinuousListView
          ref={listRef}
          textColor="#111111"
          labelColor="#666666"
          borderColor="#cccccc"
          initialPage={initialPage}
          onCurrentPageChange={p => mockRecorded.calls.push(['page', p])}
          onCurrentSurahChange={s => mockRecorded.calls.push(['surah', s])}
        />,
      );
    });
    out[`list ${initialPage} idle`] = take();
    out[`list ${initialPage} initialScrollIndex`] =
      mockRecorded.flashList?.initialScrollIndex;
    out[`list ${initialPage} data`] = createHash('sha256')
      .update(JSON.stringify(mockRecorded.flashList?.data))
      .digest('hex');
    playback(PLAYING_1_7);
    out[`list ${initialPage} playing`] = take();
    playback({
      playbackState: 'idle',
      currentVerseKey: null,
      currentVerseKeys: [],
    });
    take();
    act(() => {
      listRef.current?.scrollToVerse('1:7', true);
      listRef.current?.scrollToVerse('71:28');
      listRef.current?.scrollToPage(1);
      listRef.current?.scrollToPage(371, true);
      listRef.current?.scrollToSurah(103);
    });
    out[`list ${initialPage} scrolls`] = take();
    const data = mockRecorded.flashList?.data ?? [];
    act(() => {
      for (const index of [0, 1, 5, data.length - 1]) {
        mockRecorded.flashList?.onViewableItemsChanged?.({
          viewableItems: [{item: data[index]}],
        });
      }
    });
    out[`list ${initialPage} viewable`] = take();
    act(() => renderer?.unmount());
    take();
  }
  return out;
}

beforeAll(() => {
  dk.loadData({rewayah: 'hafs', words: fixtureWords('hafs'), lines: LINES});
  useMushafSettingsStore.setState({
    rewayah: 'hafs',
    mushafRenderer: 'dk_v2',
    showTranslation: true,
    showTransliteration: true,
  });
  useMushafPlayerStore.setState({
    playbackState: 'idle',
    currentVerseKey: null,
    currentVerseKeys: [],
  });
});

afterAll(() => mushafVerseMapService.clear());

it('Hafs list and reading modes render exactly what they rendered before', () => {
  const out = runScenarios();
  if (UPDATE) {
    fs.writeFileSync(GOLDEN, JSON.stringify(out, null, 1) + '\n');
  }
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  expect(out).toEqual(golden);
  // Hafs never asks for verse units.
  expect(mockRecorded.unitsAsked).toEqual([]);
});
