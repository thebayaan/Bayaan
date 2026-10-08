// @ai-generated
/**
 * Mushaf verse-list modes (ContinuousListView, ReadingPageView): the
 * follow-along highlight covers every Hafs verse the reciter is reciting
 * (Warsh 2:1 = Hafs 2:1 + 2:2), Hafs stays one verse, and the text font never
 * pairs IndoPak with a rewayah.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface VerseItemProps {
  verse: {verse_key: string};
  isActive?: boolean;
  dkFontFamily: string;
  unitRow?: object; // @ai
}

const mockVerseItems: VerseItemProps[] = [];
// @ai-start
const mockHeaders: {
  surahNumber?: number;
  rewayah?: string;
  visible: boolean;
}[] = [];
// @ai-end

// jest.mock factories run before this module's top-level code: build the
// verses lazily.
function mockVerses() {
  return Array.from({length: 6}, (_, i) => ({
    verse_key: `2:${i + 1}`,
    surah_number: 2,
    ayah_number: i + 1,
    text: '',
  }));
}

jest.mock('@/components/player/v2/PlayerContent/QuranView/VerseItem', () => ({
  VerseItem: (props: VerseItemProps) => {
    mockVerseItems.push(props);
    return null;
  },
}));

jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader',
  // @ai-start
  () => ({
    __esModule: true,
    default: (props: {
      surahNumber?: number;
      rewayah?: string;
      visible: boolean;
    }) => {
      mockHeaders.push(props);
      return null;
    },
  }),
  // @ai-end
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
    rewayahVerseUnitsService: {
      get: (rewayah: string) => (rewayah === 'warsh' ? warsh : null),
      getStatus: (rewayah: string) =>
        rewayah === 'warsh' ? 'ready' : 'unavailable',
    },
  };
});

jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {getThemeForVerse: () => undefined},
}));

jest.mock('@/utils/mushafPageVerses', () => ({
  getReadingPageItems: () => [
    {type: 'surah_header', surahNumber: 2, showBismillah: true}, // @ai
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

import ContinuousListView from '../ContinuousListView';
import ReadingPageView from '../ReadingPageView';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

const views: Record<string, () => React.JSX.Element> = {
  ContinuousListView: () => (
    <ContinuousListView
      textColor="#111111"
      labelColor="#666666"
      borderColor="#cccccc"
      initialPage={2}
    />
  ),
  ReadingPageView: () => (
    <ReadingPageView
      pageNumber={2}
      textColor="#111111"
      surahLabel=""
      juzLabel=""
      pageLabel=""
      labelColor="#666666"
      borderColor="#cccccc"
      cardColor="#ffffff"
      bgColor="#ffffff"
      isBookLayout={false}
    />
  ),
};

function rows(): Map<string, VerseItemProps> {
  const latest = new Map<string, VerseItemProps>();
  for (const p of mockVerseItems) latest.set(p.verse.verse_key, p);
  return latest;
}

const active = () =>
  [...rows().values()].filter(p => p.isActive).map(p => p.verse.verse_key);

function playback(state: object) {
  act(() => {
    useMushafPlayerStore.setState(state);
  });
}

beforeEach(() => {
  mockVerseItems.length = 0;
  mockHeaders.length = 0; // @ai
  useMushafSettingsStore.setState({mushafRenderer: 'dk_v2', rewayah: 'hafs'});
  useMushafPlayerStore.setState({
    playbackState: 'idle',
    currentVerseKey: null,
    currentVerseKeys: [],
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe.each(Object.keys(views))('%s', name => {
  const render = () => {
    act(() => {
      renderer = TestRenderer.create(views[name]());
    });
  };

  it('highlights every Hafs verse of the reciter verse being recited', () => {
    render();
    playback({
      playbackState: 'playing',
      currentVerseKey: '2:1',
      currentVerseKeys: ['2:1', '2:2'],
    });
    expect(active()).toEqual(['2:1', '2:2']);
    playback({currentVerseKey: '2:3', currentVerseKeys: ['2:3']});
    expect(active()).toEqual(['2:3']);
    // these views highlight only while playing (as before)
    playback({playbackState: 'paused'});
    expect(active()).toEqual([]);
  });

  it('Hafs: one verse, as before', () => {
    render();
    playback({
      playbackState: 'playing',
      currentVerseKey: '2:5',
      currentVerseKeys: ['2:5'],
    });
    expect(active()).toEqual(['2:5']);
    playback({
      playbackState: 'idle',
      currentVerseKey: null,
      currentVerseKeys: [],
    });
    expect(active()).toEqual([]);
  });

  it('keeps the reader font for Hafs and never draws a rewayah with IndoPak', () => {
    useMushafSettingsStore.setState({mushafRenderer: 'dk_indopak'});
    render();
    expect(rows().get('2:1')!.dkFontFamily).toBe('DigitalKhattIndoPak');
    act(() => renderer?.unmount());
    mockVerseItems.length = 0;
    // a state the settings gating forbids, e.g. restored from an old version
    useMushafSettingsStore.setState({
      mushafRenderer: 'dk_indopak',
      rewayah: 'warsh',
    });
    render();
    // @ai — the row is Warsh 2:1 itself (Hafs 2:1 + 2:2), not Hafs 2:1
    expect(rows().get('2:1')!.unitRow).toBeDefined();
    expect(rows().get('2:1')!.dkFontFamily).toBe('DigitalKhattV2');
  });

  // @ai-start
  it("the surah header's basmala opens its surah, in the verses' rewayah", () => {
    render();
    const header = mockHeaders.find(h => h.surahNumber === 2);
    // No rewayah prop: BasmalaHeader follows the mushaf rewayah, like the
    // verse rows below it; the surah picks its own spelling (contract C6).
    expect(header).toMatchObject({surahNumber: 2, visible: true});
    expect(header?.rewayah).toBeUndefined();
  });
  // @ai-end
});
