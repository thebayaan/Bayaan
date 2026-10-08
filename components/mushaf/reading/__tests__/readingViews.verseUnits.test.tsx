// @ai-generated
/**
 * The mushaf's list and reading modes (ContinuousListView, ReadingPageView)
 * under a non-Hafs rewayah (decision 3): rows are the rewayah's OWN verses,
 * labelled in its numbering, each drawn from exactly its own slots; the
 * follow-along band lights rows by unit keys; long-press acts on the verse
 * unit; navigation lands on the row holding a slot. Never a Hafs verse row
 * under the rewayah's name, not even while its verse units load.
 *
 * The data service is the fixture-backed stand-in with real Release 1 slots
 * (verseUnitsFixture.json on the real page-1 layout and synthetic pages);
 * VerseItem is recorded, not drawn (its unit rows: VerseItem.unitRow.test).
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {VerseUnitRow} from '@/components/player/v2/PlayerContent/QuranView/verseUnitRows';

interface MockVerseItemProps {
  verse: {verse_key: string; surah_number: number; ayah_number: number};
  isActive?: boolean;
  source?: string;
  dkFontFamily: string;
  unitRow?: VerseUnitRow;
}
interface MockFlashListProps {
  data: unknown[];
  initialScrollIndex?: number;
  renderItem: (info: {item: unknown; index: number}) => React.ReactNode;
  onViewableItemsChanged?: (info: {viewableItems: {item: unknown}[]}) => void;
}

const mockRecorded = {
  verseItems: [] as MockVerseItemProps[],
  surahDividers: [] as number[],
  flashList: null as MockFlashListProps | null,
  scrolls: [] as {index: number; animated?: boolean}[],
  themeKeys: [] as string[],
  annotationSurahs: [] as number[],
  // Page / surah reports of the vertical list.
  pages: [] as number[],
  surahs: [] as number[],
};

jest.mock('@/components/player/v2/PlayerContent/QuranView/VerseItem', () => ({
  VerseItem: (props: MockVerseItemProps) => {
    mockRecorded.verseItems.push(props);
    return null;
  },
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/BasmalaHeader',
  () => ({__esModule: true, default: () => null}),
);
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SurahDivider',
  () => ({
    __esModule: true,
    default: ({surahNumber}: {surahNumber: number}) => {
      mockRecorded.surahDividers.push(surahNumber);
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
        scrollToIndex: (args: {index: number; animated?: boolean}) => {
          mockRecorded.scrolls.push(args);
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
// The fixture-backed data service, with what useRewayahVerseUnits reads.
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
      retainRewayah: () => () => undefined,
    }),
  };
});
// The units the runtime service builds from the words in memory.
const mockUnits = {
  byRewayah: new Map<string, unknown>(),
  // Status of a rewayah without units here.
  status: 'loading',
};
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    get: (rewayah: string) => mockUnits.byRewayah.get(rewayah) ?? null,
    getStatus: (rewayah: string) =>
      mockUnits.byRewayah.has(rewayah) ? 'ready' : mockUnits.status,
  },
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {
    getThemeForVerse: (key: string) => {
      mockRecorded.themeKeys.push(key);
      return {themeIndex: 0};
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
        mockRecorded.annotationSurahs.push(surah);
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
import type {RewayahVerseUnits} from '@/services/mushaf/RewayahVerseUnits';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import {
  buildFixtureUnits,
  fixtureLines,
  fixtureWords,
  pageOfFixtureSurah as fixturePageOfSurah,
  UNITS_FIXTURE_REWAYAH,
  type UnitsFixtureDb,
} from '@/services/mushaf/__fixtures__/verseUnitPages';
import {
  unitVerseActionsPayload,
  UNNUMBERED_BASMALA_ROW_KEY,
} from '@/components/player/v2/PlayerContent/QuranView/verseUnitRows';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const dk = digitalKhattDataService as unknown as FakeDKService;
const BASMALA = UNNUMBERED_BASMALA_ROW_KEY;

let renderer: TestRenderer.ReactTestRenderer | null = null;
const listRef = React.createRef<ContinuousListViewHandle>();

/**
 * The fixture's synthetic pages (1000 + surah) moved into the mushaf's 604
 * pages (300 + surah), which the vertical list reads; page 1 stays.
 */
const pageOfFixtureSurah = (surah: number) =>
  surah === 1 ? 1 : fixturePageOfSurah(surah) - 700;
const LINES = fixtureLines().map(line =>
  line.page_number === 1
    ? line
    : {...line, page_number: line.page_number - 700},
);

/** Shows `db` in the mushaf (data, setting, verse units unless `units: false`). */
function show(db: UnitsFixtureDb, opts: {units?: boolean} = {}): void {
  const rewayah = UNITS_FIXTURE_REWAYAH[db];
  mockUnits.byRewayah.clear();
  if (opts.units !== false) {
    mockUnits.byRewayah.set(rewayah, buildFixtureUnits(db));
  }
  dk.loadData({rewayah, words: fixtureWords(db), lines: LINES});
  useMushafSettingsStore.setState({rewayah, mushafRenderer: 'dk_v2'});
}

function units(): RewayahVerseUnits {
  return mockUnits.byRewayah.get(
    useMushafSettingsStore.getState().rewayah,
  ) as RewayahVerseUnits;
}

const views = {
  ContinuousListView: (page: number) => (
    <ContinuousListView
      ref={listRef}
      textColor="#111111"
      labelColor="#666666"
      borderColor="#cccccc"
      initialPage={page}
      onCurrentPageChange={p => mockRecorded.pages.push(p)}
      onCurrentSurahChange={s => mockRecorded.surahs.push(s)}
    />
  ),
  ReadingPageView: (page: number) => (
    <ReadingPageView
      pageNumber={page}
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
type ViewName = keyof typeof views;

function render(name: ViewName, page = 1): void {
  act(() => {
    renderer = TestRenderer.create(views[name](page));
  });
}

/** The latest props of every VerseItem, by row key, in render order. */
function rows(): Map<string, MockVerseItemProps> {
  const latest = new Map<string, MockVerseItemProps>();
  for (const p of mockRecorded.verseItems) {
    latest.delete(p.verse.verse_key);
    latest.set(p.verse.verse_key, p);
  }
  return latest;
}

const rowKeys = () => [...rows().keys()];
const active = () =>
  [...rows().values()].filter(p => p.isActive).map(p => p.verse.verse_key);

function playback(state: object) {
  act(() => {
    useMushafPlayerStore.setState(state);
  });
}

/** Rows of the fixture surah `surah` in the shown rewayah (with the basmala). */
function surahRowKeys(surah: number): string[] {
  const keys = units()
    .unitsOfSurah(surah)
    .map(unit => unit.key);
  if (surah === 1 && units().isUnnumberedWordId(1)) keys.unshift(BASMALA);
  return keys;
}

beforeEach(() => {
  mockRecorded.verseItems.length = 0;
  mockRecorded.surahDividers.length = 0;
  mockRecorded.flashList = null;
  mockRecorded.scrolls.length = 0;
  mockRecorded.themeKeys.length = 0;
  mockRecorded.annotationSurahs.length = 0;
  mockRecorded.pages.length = 0;
  mockRecorded.surahs.length = 0;
  mockUnits.status = 'loading';
  useMushafSettingsStore.setState({showThemes: false});
  useMushafPlayerStore.setState({
    playbackState: 'idle',
    currentVerseKey: null,
    currentVerseKeys: [],
    currentReciterVerseKey: null,
    numberingMode: null,
    _numbering: null,
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  mushafVerseMapService.clear();
});

describe('ReadingPageView: a page of the rewayah as its own verses', () => {
  it('Warsh page 1: the basmala row (no verse), then Warsh 1:1-1:7; Hafs 1:7 is two rows', () => {
    show('warsh');
    render('ReadingPageView', 1);
    expect(rowKeys()).toEqual([
      BASMALA,
      '1:1',
      '1:2',
      '1:3',
      '1:4',
      '1:5',
      '1:6',
      '1:7',
    ]);
    expect(mockRecorded.surahDividers).toEqual([1]);
    for (const [key, props] of rows()) {
      // Every row is a rewayah verse row, labelled in its own numbering.
      expect(props.unitRow).toBeDefined();
      expect(props.verse).toBe(props.unitRow);
      if (key === BASMALA) {
        expect(props.unitRow!.unit).toBeNull();
        continue;
      }
      const unit = units().unitByKey(key)!;
      expect(props.verse.surah_number).toBe(unit.surah);
      expect(props.verse.ayah_number).toBe(unit.ayah);
      expect(props.unitRow!.words.map(w => w.text).join(' ')).toBe(
        units().unitText(unit),
      );
    }
    // Warsh 1:6 ends at its inline marker ۝٦, Warsh 1:7 is the rest of
    // Hafs 1:7 (from its fifth word).
    expect(rows().get('1:6')!.unitRow!.words.at(-1)!.text).toMatch(/۝٦$/);
    expect(rows().get('1:7')!.unitRow!.words[0].wordPositionInVerse).toBe(5);
  });

  it('the rows of every fixture page are the verses of the page in the shown numbering', () => {
    for (const db of ['warsh', 'bazzi', 'doori', 'shouba'] as const) {
      show(db);
      for (const surah of [1, 71, 103, 112]) {
        mockRecorded.verseItems.length = 0;
        render('ReadingPageView', pageOfFixtureSurah(surah));
        expect(rowKeys()).toEqual(surahRowKeys(surah));
        // = the verse units the mushaf page itself shows (and selects)
        const pageUnits = mushafVerseMapService.getOrderedUnitKeysForPage(
          pageOfFixtureSurah(surah),
        );
        expect(rowKeys().filter(k => k !== BASMALA)).toEqual(pageUnits);
        act(() => renderer?.unmount());
      }
    }
  });

  it('long-press acts on the verse: the payload names the unit, Hafs fields keep their Hafs meaning', () => {
    show('warsh');
    render('ReadingPageView', 1);
    const payload = (key: string) => {
      const props = rows().get(key)!;
      expect(props.source).toBe('mushaf');
      return unitVerseActionsPayload(props.unitRow!, 'mushaf');
    };
    expect(payload('1:7')).toEqual({
      verseKey: '1:7',
      surahNumber: 1,
      ayahNumber: 7,
      source: 'mushaf',
      rewayah: 'warsh',
      unitKeys: ['1:7'],
    });
    expect(payload('1:6')).toMatchObject({verseKey: '1:7', unitKeys: ['1:6']});
    expect(payload(BASMALA)).toBeNull();
  });

  it('themes follow the Hafs verse a row starts in', () => {
    show('warsh');
    useMushafSettingsStore.setState({showThemes: true});
    render('ReadingPageView', 1);
    expect(mockRecorded.themeKeys).toEqual([
      '1:1', // the basmala row
      '1:2',
      '1:3',
      '1:4',
      '1:5',
      '1:6',
      '1:7', // Warsh 1:6
      '1:7', // Warsh 1:7
    ]);
  });
});

describe('ContinuousListView: the rewayah as its own verses', () => {
  it('every surah header, then exactly its verse rows; no Hafs verse row', () => {
    show('warsh');
    render('ContinuousListView', 1);
    expect(mockRecorded.surahDividers).toHaveLength(114);
    const keys = rowKeys();
    const expected = [1, 71, 103, 106, 107, 112, 114].flatMap(surahRowKeys);
    expect(keys).toEqual(expected);
    for (const props of rows().values()) {
      expect(props.unitRow).toBeDefined();
      expect(props.verse).toBe(props.unitRow);
    }
  });

  it('opens at the row holding the first word of the initial page', () => {
    show('warsh');
    render('ContinuousListView', pageOfFixtureSurah(103));
    const {data, initialScrollIndex} = mockRecorded.flashList!;
    const item = data[initialScrollIndex!] as {verse: {verse_key: string}};
    expect(item.verse.verse_key).toBe('103:1');
    act(() => renderer?.unmount());
    render('ContinuousListView', 1);
    const first = mockRecorded.flashList!.data[
      mockRecorded.flashList!.initialScrollIndex!
    ] as {verse: {verse_key: string}};
    expect(first.verse.verse_key).toBe(BASMALA);
  });

  it('navigation: Hafs keys and stored anchors land on the row holding their slot', () => {
    show('warsh');
    render('ContinuousListView', 1);
    const data = () => mockRecorded.flashList!.data;
    const scrolledTo = () => {
      const {index} = mockRecorded.scrolls[mockRecorded.scrolls.length - 1];
      const item = data()[index] as {
        type: string;
        surahNumber: number;
        verse?: {verse_key: string};
      };
      return item.verse ? item.verse.verse_key : `header:${item.surahNumber}`;
    };
    act(() => listRef.current!.scrollToVerse('1:7'));
    expect(scrolledTo()).toBe('1:6');
    act(() => listRef.current!.scrollToVerse('1:7:5'));
    expect(scrolledTo()).toBe('1:7');
    act(() => listRef.current!.scrollToVerse('103:2'));
    expect(scrolledTo()).toBe('103:1');
    act(() => listRef.current!.scrollToPage(1));
    expect(scrolledTo()).toBe(BASMALA);
    act(() => listRef.current!.scrollToPage(pageOfFixtureSurah(71)));
    expect(scrolledTo()).toBe('71:1');
    act(() => listRef.current!.scrollToSurah(103));
    expect(scrolledTo()).toBe('header:103');
    // Playback scrolls by the recited Hafs verse: a Warsh reciter on Warsh
    // 1:7 (the second part of Hafs 1:7) is followed to 1:7, not 1:6.
    playback({
      playbackState: 'playing',
      currentVerseKey: '1:7',
      currentVerseKeys: ['1:7'],
      currentReciterVerseKey: '1:7',
      numberingMode: 'riwayah',
      _numbering: {reciterRewayah: 'warsh'},
    });
    act(() => listRef.current!.scrollToVerse('1:7', true));
    expect(scrolledTo()).toBe('1:7');
    expect(mockRecorded.scrolls.at(-1)!.animated).toBe(true);
  });

  it('reports the page and surah of the first visible row', () => {
    show('warsh');
    render('ContinuousListView', 1);
    const item = mockRecorded.flashList!.data.find(
      i => (i as {verse?: {verse_key: string}}).verse?.verse_key === '103:2',
    );
    act(() =>
      mockRecorded.flashList!.onViewableItemsChanged!({
        viewableItems: [{item}],
      }),
    );
    expect(mockRecorded.pages).toEqual([pageOfFixtureSurah(103)]);
    expect(mockRecorded.surahs).toEqual([103]);
    expect(mockRecorded.annotationSurahs).toEqual([103]);
  });
});

describe.each(['ReadingPageView', 'ContinuousListView'] as const)(
  '%s: follow-along lights the rows of the band',
  name => {
    it('a Warsh reciter on Warsh 1:6 lights the row 1:6 only', () => {
      show('warsh');
      render(name, 1);
      playback({
        playbackState: 'playing',
        currentVerseKey: '1:7',
        currentVerseKeys: ['1:7'],
        currentReciterVerseKey: '1:6',
        numberingMode: 'riwayah',
        _numbering: {reciterRewayah: 'warsh'},
      });
      expect(active()).toEqual(['1:6']);
      playback({currentReciterVerseKey: '1:7'});
      expect(active()).toEqual(['1:7']);
      // these views light rows only while playing (as before)
      playback({playbackState: 'paused'});
      expect(active()).toEqual([]);
    });

    it('a Hafs-numbered entry of Hafs 1:7 lights both rows holding it', () => {
      show('warsh');
      render(name, 1);
      playback({
        playbackState: 'playing',
        currentVerseKey: '1:7',
        currentVerseKeys: ['1:7'],
        currentReciterVerseKey: '1:7',
        numberingMode: 'hafs',
        _numbering: {reciterRewayah: 'hafs'},
      });
      expect(active()).toEqual(['1:6', '1:7']);
      // Hafs 1:1 (the unnumbered basmala in Warsh) lights nothing.
      playback({currentVerseKey: '1:1', currentVerseKeys: ['1:1']});
      expect(active()).toEqual([]);
    });

    it('a merged verse: Hafs 103:1 and 103:2 are the one row Warsh 103:1', () => {
      show('warsh');
      render(name, pageOfFixtureSurah(103));
      playback({
        playbackState: 'playing',
        currentVerseKey: '103:2',
        currentVerseKeys: ['103:2'],
        numberingMode: 'hafs',
        _numbering: {reciterRewayah: 'hafs'},
      });
      expect(active()).toEqual(['103:1']);
    });
  },
);

describe.each(['ReadingPageView', 'ContinuousListView'] as const)(
  '%s: never Hafs rows under a rewayah while its verses load',
  name => {
    it('loading: a spinner and no row', () => {
      show('warsh', {units: false});
      mockUnits.status = 'loading';
      render(name, 1);
      expect(mockRecorded.verseItems).toEqual([]);
      const pending = renderer!.root.findByProps({
        testID: 'verse-units-pending',
      });
      expect(
        pending.findByProps({accessibilityLabel: 'Loading the Warsh verses'}),
      ).toBeTruthy();
    });

    it('refused: a message and no row', () => {
      show('warsh', {units: false});
      mockUnits.status = 'error';
      render(name, 1);
      expect(mockRecorded.verseItems).toEqual([]);
      const pending = renderer!.root.findByProps({
        testID: 'verse-units-pending',
      });
      const texts = pending.findAll(
        node => typeof node.props.children === 'string',
      );
      expect(texts.map(node => node.props.children)).toContain(
        "Couldn't load the Warsh verses.",
      );
    });
  },
);

describe.each(['ReadingPageView', 'ContinuousListView'] as const)(
  '%s: a rewayah switch re-keys the rows',
  name => {
    it('Warsh -> al-Bazzi: the Fatiha basmala becomes verse 1', () => {
      show('warsh');
      render(name, 1);
      expect(rowKeys().slice(0, 2)).toEqual([BASMALA, '1:1']);
      act(() => renderer?.unmount());
      mockRecorded.verseItems.length = 0;
      show('bazzi');
      render(name, 1);
      expect(rowKeys().slice(0, 7)).toEqual([
        '1:1',
        '1:2',
        '1:3',
        '1:4',
        '1:5',
        '1:6',
        '1:7',
      ]);
      expect(rows().get('1:1')!.unitRow!.rewayah).toBe('al-bazzi');
    });
  },
);
