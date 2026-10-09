// @ai-generated
/**
 * The player verse list (QuranView) of a non-Hafs track recovers when its
 * verses could not be loaded: "Couldn't load the Warsh verses." comes with
 * Try Again, which loads them again and shows the list, and opening the
 * player anew loads them again by itself. Before, the message stayed for
 * the whole session.
 *
 * The real useRewayahVerseUnits and the real DigitalKhattDataService
 * (expo-sqlite faked: the Warsh words DB can be made unreadable); the units
 * service is a stand-in whose units exist while the words are in memory
 * (real slots: the verse-units fixture). With the real words DBs and the
 * real units service: QuranView.unitsRetry.alldbs.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface RowProps {
  verse: {verse_key: string};
}

interface FakeSqlite {
  files: Set<string>;
  broken: Set<string>;
}

const mockRows: RowProps[] = [];
const mockTrack = {rewayah: 'warsh'};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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

// The units service's contract with builds that take no time: units exist
// exactly while the rewayah's words are in memory.
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => {
  const dk = () =>
    (
      jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
        digitalKhattDataService: {
          isRewayahReady(r: string): boolean;
          getRewayahLoadState(r: string): string;
        };
      }
    ).digitalKhattDataService;
  const {fixtureUnits} = jest.requireActual(
    '../__fixtures__/verseUnitsFixtures',
  );
  return {
    rewayahVerseUnitsService: jest
      .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
      .verseUnitsServiceStub({
        peek: (r: string) =>
          r === 'warsh' && dk().isRewayahReady(r)
            ? fixtureUnits('warsh')
            : null,
        status: (r: string) => dk().getRewayahLoadState(r),
      }),
  };
});

jest.mock('expo-sqlite', () => {
  const state: FakeSqlite = {files: new Set(), broken: new Set()};
  const baseOf = (name: string) =>
    name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
  return {
    __fake: state,
    defaultDatabaseDirectory: '/data/user/0/app.test/files/SQLite',
    async openDatabaseAsync(name: string) {
      const base = baseOf(name);
      return {
        async getFirstAsync(sql: string) {
          if (!state.files.has(name)) return null;
          return {name: /name='(\w+)'/.exec(sql)?.[1]};
        },
        async getAllAsync(sql: string) {
          if (state.broken.has(base)) {
            throw new Error('database disk image is malformed');
          }
          if (sql.includes('FROM pages')) {
            return [
              {
                page_number: 1,
                line_number: 1,
                line_type: 'ayah',
                is_centered: 0,
                first_word_id: 1,
                last_word_id: 2,
                surah_number: 1,
              },
            ];
          }
          return [
            {id: 1, text: `${base}-1`, location: '1:1:1'},
            {id: 2, text: `${base}-2`, location: '1:1:2'},
          ];
        },
        closeAsync: async () => undefined,
      };
    },
    async importDatabaseFromAssetAsync(name: string) {
      state.files.add(name);
    },
    async deleteDatabaseAsync(name: string) {
      state.files.delete(name);
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: async () => [],
  getInfoAsync: async () => ({exists: false}),
}));

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
  useCurrentTrackRewayah: () => mockTrack.rewayah,
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
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTimestampStore} from '@/store/timestampStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const fake = (jest.requireMock('expo-sqlite') as {__fake: FakeSqlite}).__fake;
const holder = (
  jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
    __holder: {current: DigitalKhattDataService | null};
  }
).__holder;

const WARSH_ROWS = ['basmala', '1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'];

async function flush(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

async function settle(): Promise<void> {
  await act(async () => {
    await flush();
  });
}

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

/** Keys of the rows of the latest render, in list order. */
function shownRows(): string[] {
  const keys: string[] = [];
  for (const row of mockRows) {
    if (!keys.includes(row.verse.verse_key)) keys.push(row.verse.verse_key);
  }
  return keys;
}

const tryAgainButtons = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findAll(
    n =>
      n.props.testID === 'verse-units-retry' &&
      typeof n.props.onPress === 'function',
  );

const text = (renderer: TestRenderer.ReactTestRenderer) =>
  JSON.stringify(renderer.toJSON());

let now = 0;
let spies: jest.SpyInstance[] = [];

beforeEach(async () => {
  mockRows.length = 0;
  mockTrack.rewayah = 'warsh';
  fake.files.clear();
  fake.broken.clear();
  // Every test starts long after the previous one (retry intervals).
  now += 10 * 60 * 1000;
  spies = [
    jest.spyOn(Date, 'now').mockImplementation(() => now),
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
  // A Hafs mushaf; the track's Warsh words are loaded for the player.
  const instance = new DigitalKhattDataService();
  holder.current = instance;
  await instance.initialize();
});

afterEach(async () => {
  await flush(5);
  for (const spy of spies) spy.mockRestore();
});

it('Try Again loads the verses again and shows the list', async () => {
  fake.broken.add('dk_words_warsh');
  const player = openPlayer();
  await settle();
  expect(shownRows()).toEqual([]);
  expect(text(player)).toContain("Couldn't load the Warsh verses.");
  expect(tryAgainButtons(player)).toHaveLength(1);

  // Readable again (e.g. space was freed).
  fake.broken.clear();
  await act(async () => {
    tryAgainButtons(player)[0].props.onPress();
    await flush();
  });

  expect(shownRows()).toEqual(WARSH_ROWS);
  expect(text(player)).not.toContain("Couldn't load");
  expect(tryAgainButtons(player)).toHaveLength(0);
  act(() => player.unmount());
});

it('opening the player again loads the verses again', async () => {
  fake.broken.add('dk_words_warsh');
  const first = openPlayer();
  await settle();
  expect(text(first)).toContain("Couldn't load the Warsh verses.");
  act(() => first.unmount());

  fake.broken.clear();
  now += 60 * 1000;
  const again = openPlayer();
  await settle();
  expect(shownRows()).toEqual(WARSH_ROWS);
  act(() => again.unmount());
});

it('Try Again that fails again keeps the message and the button', async () => {
  fake.broken.add('dk_words_warsh');
  const player = openPlayer();
  await settle();
  await act(async () => {
    tryAgainButtons(player)[0].props.onPress();
    await flush();
  });
  expect(shownRows()).toEqual([]);
  expect(text(player)).toContain("Couldn't load the Warsh verses.");
  expect(tryAgainButtons(player)).toHaveLength(1);
  act(() => player.unmount());
});

it('no Try Again for a rewayah without a words DB', async () => {
  mockTrack.rewayah = 'hisham';
  const player = openPlayer();
  await settle();
  expect(text(player)).toContain("Couldn't load the Hisham verses.");
  expect(tryAgainButtons(player)).toHaveLength(0);
  act(() => player.unmount());
});
