// @ai-generated
/**
 * Mushaf verse-list modes (ContinuousListView, ReadingPageView): the verse a
 * jump took the reader to (a search result, a bookmark, a link, a similar
 * verse) is lit, and the reading page scrolls to it. Jumps select in the
 * mushaf's selection store, which these rows never read before: the page
 * opened at its top with nothing lit.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface VerseItemProps {
  verse: {verse_key: string};
  selected?: boolean;
  unitRow?: object;
}

const mockVerseItems: VerseItemProps[] = [];
const mockHeaders: object[] = [];

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
  () => ({
    __esModule: true,
    default: (props: object) => {
      mockHeaders.push(props);
      return null;
    },
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

import ContinuousListView from '../ContinuousListView';
import ReadingPageView from '../ReadingPageView';
import {PAGE_PADDING_TOP} from '../../constants';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';

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
      width={390}
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
      pageSize={{width: 390, height: 844}}
    />
  ),
};

function rows(): Map<string, VerseItemProps> {
  const latest = new Map<string, VerseItemProps>();
  for (const p of mockVerseItems) latest.set(p.verse.verse_key, p);
  return latest;
}

const lit = () =>
  [...rows().values()].filter(p => p.selected).map(p => p.verse.verse_key);

function select(run: () => void) {
  act(run);
}
const selection = () => useMushafVerseSelectionStore.getState();

beforeEach(() => {
  mockVerseItems.length = 0;
  mockHeaders.length = 0;
  useMushafSettingsStore.setState({mushafRenderer: 'dk_v2', rewayah: 'hafs'});
  useMushafVerseSelectionStore.getState().clearSelection();
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

  it('lights the verse a jump selected, and only while it is selected', () => {
    render();
    expect(lit()).toEqual([]);
    // unset while nothing is selected: the rows' props stay as before
    // (readingViews.hafsGolden hashes them as JSON)
    expect([...rows().values()].every(p => p.selected === undefined)).toBe(
      true,
    );
    select(() => selection().selectVerse('2:4', 2));
    expect(lit()).toEqual(['2:4']);
    select(() => selection().clearSelection());
    expect(lit()).toEqual([]);
  });

  it("a rewayah's rows: a Hafs jump lights the row holding that verse", () => {
    useMushafSettingsStore.setState({rewayah: 'warsh'});
    render();
    // Hafs 2:2 is inside Warsh 2:1 (Hafs 2:1 + 2:2)
    select(() => selection().selectVerse('2:2', 2));
    expect(lit()).toEqual(['2:1']);
    // Hafs 2:4 is Warsh 2:3
    select(() => selection().selectVerse('2:4', 2));
    expect(lit()).toEqual(['2:3']);
    // a verse in the rewayah's own numbering is that row
    select(() =>
      selection().selectUnits(
        'warsh',
        [{key: '2:2', anchor: '2:3', hafsKeys: ['2:3']}],
        2,
      ),
    );
    expect(lit()).toEqual(['2:2']);
    // another rewayah's numbering lights nothing rather than a wrong verse
    select(() =>
      selection().selectUnits(
        'qalun',
        [{key: '2:2', anchor: '2:3', hafsKeys: ['2:3']}],
        2,
      ),
    );
    expect(lit()).toEqual([]);
  });

  it('Hafs rows never light a selection in a rewayah numbering', () => {
    render();
    select(() =>
      selection().selectUnits(
        'warsh',
        [{key: '2:2', anchor: '2:3', hafsKeys: ['2:3']}],
        2,
      ),
    );
    expect(lit()).toEqual([]);
  });
});

describe('ReadingPageView', () => {
  const render = () => {
    act(() => {
      renderer = TestRenderer.create(views.ReadingPageView());
    });
  };
  /** The page's ScrollView (the jest preset's mock class component). */
  const scrollView = () =>
    renderer!.root.find(
      n =>
        typeof n.props.onScrollBeginDrag === 'function' &&
        typeof n.instance?.scrollTo === 'function',
    );
  const scrollTo = () => scrollView().instance.scrollTo as jest.Mock;
  /** Lays the row out at `y` in the page's content, as onLayout reports. */
  const layOut = (verseKey: string, y: number) => {
    const row = renderer!.root.find(
      n =>
        typeof n.props.onVersePress === 'function' &&
        n.props.verse.verse_key === verseKey,
    ).parent!;
    act(() =>
      row.props.onLayout({
        nativeEvent: {layout: {x: 0, y, width: 300, height: 80}},
      }),
    );
  };

  it("does not light another page's selection", () => {
    render();
    select(() => selection().selectVerse('2:4', 3));
    expect(lit()).toEqual([]);
  });

  it('scrolls a page already laid out to the selected verse, below the header', () => {
    render();
    ['2:1', '2:2', '2:3', '2:4', '2:5', '2:6'].forEach((key, i) =>
      layOut(key, 100 + i * 300),
    );
    scrollTo().mockClear();
    select(() => selection().selectVerse('2:4', 2));
    expect(scrollTo()).toHaveBeenCalledWith({
      y: 1000 - PAGE_PADDING_TOP,
      animated: true,
    });
  });

  it('follows the row while the page is first laid out, until the reader drags', () => {
    // The jump selects before the pager has mounted the page.
    select(() => selection().selectVerse('2:5', 2));
    render();
    scrollTo().mockClear();
    layOut('2:1', 100);
    expect(scrollTo()).not.toHaveBeenCalled();
    layOut('2:5', 900);
    expect(scrollTo()).toHaveBeenLastCalledWith({
      y: 900 - PAGE_PADDING_TOP,
      animated: false,
    });
    // a row above it measured taller: the row moved down, the page follows
    layOut('2:5', 1300);
    expect(scrollTo()).toHaveBeenLastCalledWith({
      y: 1300 - PAGE_PADDING_TOP,
      animated: false,
    });
    // the reader takes over
    act(() => scrollView().props.onScrollBeginDrag());
    scrollTo().mockClear();
    layOut('2:5', 1500);
    expect(scrollTo()).not.toHaveBeenCalled();
  });

  // @ai-start
  it('a second jump to the verse still lit scrolls back after the reader dragged', () => {
    render();
    ['2:1', '2:2', '2:3', '2:4', '2:5', '2:6'].forEach((key, i) =>
      layOut(key, 100 + i * 300),
    );
    select(() => selection().selectVerse('2:4', 2));
    act(() => scrollView().props.onScrollBeginDrag());
    scrollTo().mockClear();
    select(() => selection().selectVerse('2:4', 2));
    expect(scrollTo()).toHaveBeenCalledWith({
      y: 1000 - PAGE_PADDING_TOP,
      animated: true,
    });
    // and the row is followed again while it is laid out
    scrollTo().mockClear();
    layOut('2:4', 1200);
    expect(scrollTo()).toHaveBeenLastCalledWith({
      y: 1200 - PAGE_PADDING_TOP,
      animated: false,
    });
  });
  // @ai-end

  it('never scrolls above the top for a verse near it', () => {
    select(() => selection().selectVerse('2:1', 2));
    render();
    scrollTo().mockClear();
    layOut('2:1', 40);
    expect(scrollTo()).toHaveBeenLastCalledWith({y: 0, animated: false});
  });
});
