// @ai-generated
/**
 * LOCAL-ONLY (skipped unless BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.13
 * for node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest QuranView.unitsRetry.alldbs --watchAll=false
 *
 * The player verse list of a Warsh track after its words failed to load,
 * end to end on the real data: the real DigitalKhattDataService reads the
 * bundled Hafs and Warsh words DBs (the Warsh one unreadable at first), the
 * real RewayahVerseUnitsService builds the Warsh verse units after
 * interactions in chunks (the app's scheduler) and cross-checks them with
 * the bundled verse map, and the real useRewayahVerseUnits feeds the real
 * QuranView. "Couldn't load the Warsh verses." comes with Try Again, which
 * ends in 'ready' with Warsh al-Fatihah listed (the unnumbered basmala, then
 * Warsh 1:1-1:7, Warsh 1:6 holding the first words of Hafs 1:7); opening
 * the player again recovers the same way without a tap.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {RewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';

interface RowProps {
  verse: {verse_key: string};
  unitRow?: {parts: {hafsKey: string}[]};
}

const mockRows: RowProps[] = [];
const mockUnits: {current: RewayahVerseUnitsService | null} = {current: null};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-sqlite', () =>
  jest
    .requireActual('@/services/mushaf/__fixtures__/bundledDkSqlite')
    .bundledDkSqliteModule(),
);

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: async () => [],
  getInfoAsync: async () => ({exists: false}),
}));

// QuranView reads the app's singleton; each test installs its own instance.
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const actual = jest.requireActual(
    '@/services/mushaf/DigitalKhattDataService',
  );
  const holder: {current: unknown} = {current: null};
  const mocked = Object.assign({}, actual, {__holder: holder});
  Object.defineProperty(mocked, 'digitalKhattDataService', {
    enumerable: true,
    get: () => holder.current,
  });
  return mocked;
});

// The app's singleton is the real service of each test (over its data
// service, with the app's scheduler).
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => {
  const actual = jest.requireActual(
    '@/services/mushaf/RewayahVerseUnitsService',
  );
  return {
    ...actual,
    rewayahVerseUnitsService: {
      peek: (r: string) => mockUnits.current?.peek(r as never) ?? null,
      getStatus: (r: string) =>
        mockUnits.current?.getStatus(r as never) ?? 'idle',
      getError: (r: string) => mockUnits.current?.getError(r as never) ?? null,
      request: (r: string) =>
        mockUnits.current?.request(r as never) ?? Promise.resolve(null),
      retry: (r: string) =>
        mockUnits.current?.retry(r as never) ?? Promise.resolve(null),
      subscribe: (listener: () => void) =>
        mockUnits.current?.subscribe(listener) ?? (() => undefined),
      getVersion: () => mockUnits.current?.getVersion() ?? 0,
    },
  };
});

jest.mock('../VerseItem', () => ({
  VerseItem: (props: RowProps) => {
    mockRows.push(props);
    return null;
  },
}));

jest.mock('../BasmalaHeader', () => ({__esModule: true, default: () => null}));

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
  useCurrentTrackRewayah: () => 'warsh',
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
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
    usePlayerStore: create(() => ({
      queue: {tracks: [{id: 'track-1', surahId: '1'}], currentIndex: 0},
    })),
  };
});

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));

jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

jest.mock('@/utils/translationLookup', () => ({
  getTranslationName: () => 'Translation',
}));

jest.mock('@/config/branding', () => ({__esModule: true, default: {}}));

// Placeholder Hafs verses with a translation per Hafs key.
jest.mock('@/utils/enhancedVerseData', () => ({
  enhancedVersesBySurah: {
    1: Array.from({length: 7}, (_, i) => ({
      id: i + 1,
      verse_key: `1:${i + 1}`,
      surah_number: 1,
      ayah_number: i + 1,
      text: `HAFS-TEXT-1:${i + 1}`,
      translation: `T(1:${i + 1})`,
      transliteration: `TL(1:${i + 1})`,
    })),
  },
  rebuildEnhancedVerses: async () => false,
}));

import {QuranView} from '../index';
import {DigitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {hasNodeSqlite} from '@/services/mushaf/__fixtures__/bundledDkSqlite';
import type {BundledDkSqliteFake} from '@/services/mushaf/__fixtures__/bundledDkSqlite';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTimestampStore} from '@/store/timestampStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const sqlite = (
  jest.requireMock('expo-sqlite') as {__fake: BundledDkSqliteFake}
).__fake;
const holder = (
  jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
    __holder: {current: DigitalKhattDataService | null};
  }
).__holder;

const WARSH_ROWS = ['basmala', '1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'];

function openPlayer(): TestRenderer.ReactTestRenderer {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <QuranView
        currentSurah={1}
        onVersePress={() => undefined}
        showTranslation
        transliterationFontSize={14}
        translationFontSize={15}
        arabicFontSize={24}
      />,
    );
  });
  return renderer;
}

/** The rows of the latest renders, by key, in list order. */
function shownRows(): Map<string, RowProps> {
  const rows = new Map<string, RowProps>();
  for (const row of mockRows) rows.set(row.verse.verse_key, row);
  return rows;
}

const text = (renderer: TestRenderer.ReactTestRenderer) =>
  JSON.stringify(renderer.toJSON());

const tryAgainButtons = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findAll(
    n =>
      n.props.testID === 'verse-units-retry' &&
      typeof n.props.onPress === 'function',
  );

/** Lets loads, chunks and renders run until `done()` (at most ~20 s). */
async function until(done: () => boolean): Promise<void> {
  for (let i = 0; i < 2000 && !done(); i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
}

function expectWarshFatihah(): void {
  const rows = shownRows();
  expect([...rows.keys()]).toEqual(WARSH_ROWS);
  // Real Warsh units: 1:6 and 1:7 share Hafs 1:7.
  expect(rows.get('1:6')?.unitRow?.parts.map(p => p.hafsKey)).toEqual(['1:7']);
  expect(rows.get('1:7')?.unitRow?.parts.map(p => p.hafsKey)).toEqual(['1:7']);
}

const realNow = Date.now.bind(Date);
let offset = 0;

const run =
  process.env.BAYAAN_OVERLAY_DB_DIR && hasNodeSqlite()
    ? describe
    : describe.skip;

run('the player list recovers from a failed load (local only)', () => {
  let spies: jest.SpyInstance[] = [];

  beforeEach(async () => {
    mockRows.length = 0;
    sqlite.broken.clear();
    // Every test starts long after the previous one's automatic retry; the
    // clock still runs (the units are built in timed chunks).
    offset += 10 * 60 * 1000;
    spies = [
      jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset),
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      // react-test-renderer prints a deprecation notice under React 19.
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    useMushafSettingsStore.setState({
      mushafRenderer: 'dk_v2',
      rewayah: 'hafs',
      selectedTranslationId: 'saheeh',
    });
    useTimestampStore.setState({
      currentAyah: null,
      currentSurahTimestamps: null,
      isLocked: true,
    });
    // A Hafs mushaf; the Warsh track's words are a side copy.
    const dk = new DigitalKhattDataService();
    holder.current = dk;
    await dk.initialize();
    const {RewayahVerseUnitsService: Service} = jest.requireActual(
      '@/services/mushaf/RewayahVerseUnitsService',
    );
    mockUnits.current = new Service(dk) as RewayahVerseUnitsService;
  });

  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
  });

  it('a failed load, then Try Again: ready, and the list is shown', async () => {
    sqlite.broken.add('dk_words_warsh');
    const player = openPlayer();
    await until(() => text(player).includes("Couldn't load"));
    expect(text(player)).toContain("Couldn't load the Warsh verses.");
    expect(mockUnits.current?.getStatus('warsh')).toBe('error');
    expect(shownRows().size).toBe(0);

    sqlite.broken.clear();
    await act(async () => {
      tryAgainButtons(player)[0].props.onPress();
    });
    await until(() => shownRows().size > 0);

    expect(mockUnits.current?.getStatus('warsh')).toBe('ready');
    expectWarshFatihah();
    expect(text(player)).not.toContain("Couldn't load");
    act(() => player.unmount());
  });

  it('a failed load, then the player opened again: ready without a tap', async () => {
    sqlite.broken.add('dk_words_warsh');
    const first = openPlayer();
    await until(() => text(first).includes("Couldn't load"));
    act(() => first.unmount());

    sqlite.broken.clear();
    offset += 60 * 1000;
    const again = openPlayer();
    await until(() => shownRows().size > 0);

    expect(mockUnits.current?.getStatus('warsh')).toBe('ready');
    expectWarshFatihah();
    act(() => again.unmount());
  });

  it('Hafs failed at startup, the Warsh words loaded: Try Again starts up again', async () => {
    // A launch whose Hafs words cannot be read: no main cache, whose word
    // ids and Hafs locations the Warsh units are read with.
    sqlite.broken.add('dk_words');
    const dk = new DigitalKhattDataService();
    holder.current = dk;
    await dk.initialize().catch(() => undefined);
    expect(dk.initialized).toBe(false);
    const {RewayahVerseUnitsService: Service} = jest.requireActual(
      '@/services/mushaf/RewayahVerseUnitsService',
    );
    mockUnits.current = new Service(dk) as RewayahVerseUnitsService;

    const player = openPlayer();
    await until(() => text(player).includes("Couldn't load"));
    expect(dk.isRewayahReady('warsh')).toBe(true);
    expect(mockUnits.current?.getStatus('warsh')).toBe('error');
    expect(tryAgainButtons(player)).toHaveLength(1);

    sqlite.broken.clear();
    await act(async () => {
      tryAgainButtons(player)[0].props.onPress();
    });
    await until(() => shownRows().size > 0);

    expect(dk.initialized).toBe(true);
    expect(mockUnits.current?.getStatus('warsh')).toBe('ready');
    expectWarshFatihah();
    act(() => player.unmount());
  });
});
