// @ai-generated
/**
 * The mushaf search overlay in the numbering of the rewayah on screen
 * (decision 3), on real slots of the Release 1 words DBs (fixture):
 *  - Warsh on screen: "106:5" is Warsh 106:5 (the later part of Hafs
 *    106:4), opened as that verse of Warsh; its history entry keeps the
 *    storage anchor and the rewayah, never the Warsh number;
 *  - a history entry opens the verse holding its anchor in the rewayah on
 *    screen; older entries (Hafs numbers) open their Hafs verse as before;
 *  - a bookmark chip opens its bookmark as the Bookmarks list does: its
 *    rewayah restored first, then exactly its verse selected;
 *  - Hafs on screen: results, navigation calls and history entries are
 *    exactly those of before.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {VerseBookmark} from '@/types/verse-annotations';

let mockShownRewayah: RewayahId = 'hafs';
let mockUnitsReady = true;
const mockPages: Record<string, number> = {
  '106:4': 602,
  '1:7': 1,
  '2:255': 42,
};

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    get rewayah() {
      return mockShownRewayah;
    },
    getPageForVerse: (key: string) => mockPages[key],
  },
}));

jest.mock('@/hooks/useRewayahVerseUnits', () => ({
  useRewayahVerseUnits: (rewayah: RewayahId | null) => {
    if (!rewayah) return {units: null, status: 'unavailable'};
    if (!mockUnitsReady) return {units: null, status: 'loading'};
    const {
      fixtureUnits,
    } = require('@/services/verse-annotations/__fixtures__/verseUnitsTestData');
    return {units: fixtureUnits(rewayah), status: 'ready'};
  },
}));

const mockRestore = jest.fn((saved?: RewayahId) => {
  if (saved) mockShownRewayah = saved;
  return Promise.resolve();
});
jest.mock('@/services/verse-annotations/restoreSavedRewayah', () => ({
  restoreSavedRewayah: (saved?: RewayahId) => mockRestore(saved),
}));

jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({
      peek: (rewayah: RewayahId) => {
        if (!mockUnitsReady) return null;
        const {
          fixtureUnits,
        } = require('@/services/verse-annotations/__fixtures__/verseUnitsTestData');
        return fixtureUnits(rewayah);
      },
    }),
}));

let mockChipsProps: {
  shownRewayah?: RewayahId;
  onPress?: (bookmark: VerseBookmark) => Promise<void>;
} = {};
jest.mock('../BookmarkChips', () => ({
  BookmarkChips: (props: typeof mockChipsProps) => {
    mockChipsProps = props;
    return null;
  },
}));

// The browse list draws only its header (recent reads, bookmark chips).
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ListHeaderComponent}: {ListHeaderComponent?: unknown}) =>
    ListHeaderComponent ?? null,
}));
jest.mock('@/components/SurahItem', () => ({SurahItem: () => null}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111', textSecondary: '#666', background: '#fff'}},
    isDarkMode: false,
  }),
}));
jest.mock('@/hooks/useSettings', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useSettings: create(() => ({
      browseSortOption: 'asc',
      setBrowseSortOption: () => undefined,
    })),
  };
});
jest.mock('@/components/SearchInput', () => {
  const ReactActual = jest.requireActual('react');
  return {
    SearchInput: ReactActual.forwardRef(
      (props: Record<string, unknown>, _ref: unknown) =>
        ReactActual.createElement('SearchInput', props),
    ),
  };
});

import MushafSearchView from '../MushafSearchView';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const HISTORY_KEY = 'mushaf-search-history';

const mounted: TestRenderer.ReactTestRenderer[] = [];

interface Callbacks {
  onNavigateToVerse: jest.Mock;
  onNavigateToPage: jest.Mock;
  onNavigateToSurah: jest.Mock;
}

async function renderSearch(autoFocusSearch = true): Promise<{
  renderer: TestRenderer.ReactTestRenderer;
  calls: Callbacks;
}> {
  const calls: Callbacks = {
    onNavigateToVerse: jest.fn(),
    onNavigateToPage: jest.fn(),
    onNavigateToSurah: jest.fn(),
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <MushafSearchView
        {...calls}
        onResumeChain={jest.fn()}
        onClose={jest.fn()}
        surahStartPages={{}}
        pageToSurah={{}}
        autoFocusSearch={autoFocusSearch}
      />,
    );
  });
  mounted.push(renderer);
  return {renderer, calls};
}

function activeInput(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.find(
    n => (n.type as unknown) === 'SearchInput' && n.props.editable !== false,
  );
}

async function search(renderer: TestRenderer.ReactTestRenderer, q: string) {
  await act(async () => {
    (activeInput(renderer).props.onChangeText as (t: string) => void)(q);
  });
}

/** Primary / secondary texts of the visible results, and their presses. */
function results(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.props.item?.primary !== undefined,
    )
    .map(n => ({
      primary: n.props.item.primary as string,
      secondary: n.props.item.secondary as string,
      press: n.props.onPress as () => void,
    }));
}

/** History rows: their shown label and press. */
function historyRows(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        typeof n.props.label === 'string' &&
        n.props.item !== undefined,
    )
    .map(n => ({
      label: n.props.label as string,
      press: n.props.onPress as () => void,
    }));
}

async function storedHistory(): Promise<Record<string, unknown>[]> {
  return JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) ?? '[]');
}

beforeEach(async () => {
  jest.useFakeTimers({doNotFake: ['nextTick', 'setImmediate']});
  await AsyncStorage.clear();
  mockShownRewayah = 'hafs';
  mockUnitsReady = true;
  mockRestore.mockClear();
  mockChipsProps = {};
});

afterEach(() => {
  // Unmount before the lists' deferred updates fire (no act warnings).
  act(() => {
    for (const renderer of mounted.splice(0)) renderer.unmount();
  });
  jest.useRealTimers();
});

describe('Hafs on screen: as before', () => {
  it('"2:255" opens Hafs 2:255 and stores the Hafs entry', async () => {
    const {renderer, calls} = await renderSearch();
    await search(renderer, '2:255');
    const [result] = results(renderer);
    expect(result.primary).toBe('Al-Baqarah 2:255');
    expect(result.secondary).toBe('Verse 255');
    await act(async () => result.press());
    expect(calls.onNavigateToVerse.mock.calls).toEqual([['2:255', 42]]);
    const [entry] = await storedHistory();
    expect(Object.keys(entry)).toEqual([
      'type',
      'label',
      'timestamp',
      'surahId',
      'verse',
    ]);
    expect(entry).toMatchObject({
      type: 'verse',
      label: 'Al-Baqarah 2:255',
      surahId: 2,
      verse: 255,
    });
  });

  it('"106:5" does not exist in Hafs', async () => {
    const {renderer} = await renderSearch();
    await search(renderer, '106:5');
    expect(results(renderer)).toEqual([]);
  });
});

describe('Warsh on screen: Warsh numbering', () => {
  beforeEach(() => {
    mockShownRewayah = 'warsh';
  });

  it('"106:5" opens Warsh 106:5 and stores its anchor, not its number', async () => {
    const {renderer, calls} = await renderSearch();
    await search(renderer, '106:5');
    const [result] = results(renderer);
    expect(result.primary).toBe('Quraysh 106:5');
    expect(result.secondary).toBe('Verse 5 · Warsh');
    await act(async () => result.press());
    // The page of the Hafs verse holding its first word; the Warsh key.
    expect(calls.onNavigateToVerse.mock.calls).toEqual([
      ['106:5', 602, 'warsh'],
    ]);
    const [entry] = await storedHistory();
    expect(entry).toMatchObject({
      type: 'verse',
      label: 'Quraysh 106:5 · Warsh',
      surahId: 106,
      anchor: '106:4:5',
      rewayah: 'warsh',
    });
    expect(entry).not.toHaveProperty('verse');
  });

  it('the two parts of split Hafs 1:7 are two verses', async () => {
    const {renderer, calls} = await renderSearch();
    await search(renderer, '1:6');
    await act(async () => results(renderer)[0].press());
    await search(renderer, '1:7');
    await act(async () => results(renderer)[0].press());
    expect(calls.onNavigateToVerse.mock.calls).toEqual([
      ['1:6', 1, 'warsh'],
      ['1:7', 1, 'warsh'],
    ]);
  });

  it('no verse result while the Warsh verses load', async () => {
    mockUnitsReady = false;
    const {renderer} = await renderSearch();
    await search(renderer, '1:7');
    expect(results(renderer)).toEqual([]);
  });

  it('history: anchors open their verse in the rewayah on screen', async () => {
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          type: 'verse',
          label: 'Quraysh 106:5 · Warsh',
          surahId: 106,
          anchor: '106:4:5',
          rewayah: 'warsh',
          timestamp: 2,
        },
        // An entry of before: Hafs numbers.
        {
          type: 'verse',
          label: 'Al-Fatihah 1:7',
          surahId: 1,
          verse: 7,
          timestamp: 1,
        },
      ]),
    );
    const {renderer, calls} = await renderSearch();
    const rows = historyRows(renderer);
    expect(rows.map(r => r.label)).toEqual([
      'Quraysh 106:5 · Warsh',
      // A Hafs entry says so with Warsh on screen.
      'Al-Fatihah 1:7 · Hafs',
    ]);
    await act(async () => rows[0].press());
    await act(async () => rows[1].press());
    expect(calls.onNavigateToVerse.mock.calls).toEqual([
      ['106:5', 602, 'warsh'],
      // The Hafs verse, as before (the mushaf shows the Warsh verses
      // holding it).
      ['1:7', 1],
    ]);

    // The same entries with Hafs on screen: labels as saved; the anchor
    // opens the Hafs verse holding it.
    mockShownRewayah = 'hafs';
    const hafs = await renderSearch();
    expect(historyRows(hafs.renderer).map(r => r.label)).toEqual([
      'Quraysh 106:5 · Warsh',
      'Al-Fatihah 1:7',
    ]);
    await act(async () => historyRows(hafs.renderer)[0].press());
    expect(hafs.calls.onNavigateToVerse.mock.calls).toEqual([['106:4', 602]]);
  });

  it('history while the verses load: opens the page of the anchor', async () => {
    mockUnitsReady = false;
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          type: 'verse',
          label: 'Quraysh 106:5 · Warsh',
          surahId: 106,
          anchor: '106:4:5',
          rewayah: 'warsh',
          timestamp: 2,
        },
      ]),
    );
    const {renderer, calls} = await renderSearch();
    await act(async () => historyRows(renderer)[0].press());
    expect(calls.onNavigateToVerse).not.toHaveBeenCalled();
    expect(calls.onNavigateToPage.mock.calls).toEqual([[602]]);
  });
});

describe('bookmark chips open their bookmark', () => {
  function bookmark(verseKey: string, rewayahId?: RewayahId): VerseBookmark {
    const [surah, ayah] = verseKey.split(':').map(Number);
    return {
      id: verseKey,
      verseKey,
      surahNumber: surah,
      ayahNumber: ayah,
      createdAt: 0,
      rewayahId,
    };
  }

  async function press(row: VerseBookmark) {
    const {calls} = await renderSearch(false);
    const onPress = mockChipsProps.onPress;
    if (!onPress) throw new Error('chips not rendered');
    await act(async () => onPress(row));
    return calls;
  }

  it('Hafs bookmark, Hafs on screen: as before', async () => {
    const calls = await press(bookmark('2:255', 'hafs'));
    expect(mockRestore.mock.calls).toEqual([['hafs']]);
    expect(calls.onNavigateToVerse.mock.calls).toEqual([['2:255', 42]]);
  });

  it('the chips know the rewayah on screen', async () => {
    mockShownRewayah = 'warsh';
    await renderSearch(false);
    expect(mockChipsProps.shownRewayah).toBe('warsh');
  });

  it('Warsh bookmark: exactly its Warsh verse, after restoring Warsh', async () => {
    const later = {...bookmark('1:7', 'warsh'), verseKey: '1:7:5'};
    const calls = await press(later);
    expect(mockRestore.mock.calls).toEqual([['warsh']]);
    expect(calls.onNavigateToVerse.mock.calls).toEqual([['1:7', 1, 'warsh']]);
    const first = await press(bookmark('1:7', 'warsh'));
    expect(first.onNavigateToVerse.mock.calls).toEqual([['1:6', 1, 'warsh']]);
  });

  it('Hafs bookmark with Warsh on screen: Hafs restored, its Hafs verse', async () => {
    mockShownRewayah = 'warsh';
    const calls = await press(bookmark('1:7', 'hafs'));
    expect(mockRestore.mock.calls).toEqual([['hafs']]);
    expect(calls.onNavigateToVerse.mock.calls).toEqual([['1:7', 1]]);
  });

  it('a legacy bookmark opens in the rewayah on screen', async () => {
    mockShownRewayah = 'warsh';
    const calls = await press(bookmark('106:4'));
    expect(mockRestore.mock.calls).toEqual([[undefined]]);
    // The Warsh verse holding the start of Hafs 106:4.
    expect(calls.onNavigateToVerse.mock.calls).toEqual([
      ['106:4', 602, 'warsh'],
    ]);
  });

  it('no verse can be named: its page', async () => {
    mockUnitsReady = false;
    const calls = await press({
      ...bookmark('106:4', 'warsh'),
      verseKey: '106:4:5',
    });
    expect(calls.onNavigateToVerse).not.toHaveBeenCalled();
    expect(calls.onNavigateToPage.mock.calls).toEqual([[602]]);
  });
});
