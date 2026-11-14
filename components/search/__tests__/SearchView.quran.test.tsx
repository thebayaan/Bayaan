// @ai-generated
/**
 * SearchView with the Quran text search: an Arabic query lists the catalogue
 * rows, then the Ayahs section; a Latin query leaves the Quran search off
 * (unless the catalogue finds nothing and the keys spell Arabic on the
 * Arabic layout); a root query lists only the root's words; a verse opens
 * the Mushaf on its matched words and is remembered; the empty state needs
 * both searches empty.
 */
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {QuranSearchState} from '@/hooks/useQuranSearch';
import type {QuranResultRowViewProps} from '@/components/search/quran/QuranResultRowView';
import type {QuranRoot} from '@/services/search/QuranSearchDataService';
import type {QuranVerseHit} from '@/utils/search/quranSearch';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({useRouter: () => ({push: mockPush})}));
jest.mock('expo-router/react-navigation', () => ({useHeaderHeight: () => 0}));

// The catalogue: surah and reciter matches by query.
const mockCatalog = new Map<string, {type: string; item: object}[]>();
const mockCatalogQueries: string[] = [];
jest.mock('@/utils/search/catalog', () => ({
  createCatalogSearch: () => ({
    search: (query: string) => {
      mockCatalogQueries.push(query);
      return (mockCatalog.get(query) ?? []).map(r => ({...r, score: 1}));
    },
  }),
}));
jest.mock('@/services/dataService', () => ({
  getAllReciters: async () => [],
  getAllSurahs: async () => [],
}));

// The Quran search: a state per query; idle when not enabled.
const mockQuranStates = new Map<string, QuranSearchState>();
const mockQuranCalls: {query: string; enabled: boolean | undefined}[] = [];
jest.mock('@/hooks/useQuranSearch', () => ({
  useQuranSearch: (query: string, options: {enabled?: boolean} = {}) => {
    mockQuranCalls.push({query, enabled: options.enabled});
    if (options.enabled === false) return {status: 'idle'};
    return mockQuranStates.get(query) ?? {status: 'idle'};
  },
  isQuranQuery: (query: string) =>
    jest.requireActual('@/utils/search/quranText').parseQuranQuery(query)
      .kind !== 'none',
  prefetchQuranSearch: jest.fn(),
}));

// Rows render as text: the row key (and a header's note); a press acts on
// the verse or the root suggestion.
jest.mock('@/components/search/quran/QuranResultRowView', () => {
  const {Text: MockText} = jest.requireActual('react-native');
  return {
    QuranResultRowView: ({
      row,
      onVersePress,
      onRootPress,
    }: QuranResultRowViewProps) => (
      <MockText
        testID="quran-row"
        onPress={() => {
          if (row.type === 'quran-verse') onVersePress(row.hit);
          if (row.type === 'quran-root-suggestion') onRootPress(row.root);
        }}>
        {row.type === 'quran-header' ? `${row.key}:${row.note}` : row.key}
      </MockText>
    ),
  };
});
jest.mock('@/components/search/quran/RecentVerseRow', () => {
  const {Text: MockText} = jest.requireActual('react-native');
  return {
    RecentVerseRow: ({
      verseKey,
      onPress,
    }: {
      verseKey: string;
      onPress: () => void;
    }) => (
      <MockText testID="recent-verse" onPress={onPress}>
        {verseKey}
      </MockText>
    ),
  };
});
jest.mock('@/components/SurahItem', () => {
  const {Text: MockText} = jest.requireActual('react-native');
  return {
    SurahItem: ({item}: {item: {name: string}}) => (
      <MockText testID="catalog-row">{item.name}</MockText>
    ),
  };
});
jest.mock('@/components/ReciterItem', () => {
  const {Text: MockText} = jest.requireActual('react-native');
  return {
    ReciterItem: ({item}: {item: {name: string}}) => (
      <MockText testID="catalog-row">{item.name}</MockText>
    ),
  };
});

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getPageForWord: (verseKey: string, position: number) =>
      verseKey === '2:255' && position === 3 ? 42 : undefined,
  },
}));
let mockRewayah = 'hafs';
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (select: (s: {rewayah: string}) => unknown) =>
    select({rewayah: mockRewayah}),
}));

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/search/ReciteToSearchRow', () => ({
  ReciteToSearchRow: () => null,
}));
jest.mock('@/components/search/ExploreView', () => ({ExploreView: () => null}));
jest.mock('@/components/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));
const mockTabletRows: unknown[][] = [];
jest.mock('@/components/search/TabletSearchResults', () => ({
  TabletSearchResults: ({quranRows}: {quranRows: unknown[]}) => {
    mockTabletRows.push(quranRows);
    return null;
  },
}));
jest.mock('@/components/sheets/options/surahOptions', () => ({
  SurahOptionsProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#000000', textSecondary: '#666666', background: '#fff'},
      fonts: {bold: 'b', semiBold: 's', medium: 'm', regular: 'r'},
    },
  }),
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({askEveryTime: true, defaultReciterSelection: 'ask'}),
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: (select: (s: {defaultReciter: null}) => unknown) =>
    select({defaultReciter: null}),
}));
jest.mock('@/hooks/useReciterSelection', () => ({
  useReciterSelection: () => ({
    playWithReciter: jest.fn(),
    playWithRandomReciter: jest.fn(),
  }),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({addToQueue: jest.fn()}),
}));
jest.mock('@/utils/track', () => ({createTracksForReciter: jest.fn()}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
let mockTablet = false;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isTablet: mockTablet,
    width: mockTablet ? 1032 : 390,
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackSearchPerformed: jest.fn()},
}));

import {SearchView} from '../SearchView';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function hit(verseKey: string, position: number, length = 1): QuranVerseHit {
  return {verseIndex: 0, verseKey, matches: [{position, length}], score: 100};
}

function textDone(
  hits: QuranVerseHit[],
  rootSuggestions: QuranRoot[] = [],
): QuranSearchState {
  return {
    status: 'done',
    outcome: {
      kind: 'text',
      result: {
        kind: 'phrase',
        hits,
        ayahCount: hits.length,
        occurrenceCount: hits.length,
      },
      rootSuggestions,
    },
  };
}

const RAHMA: QuranRoot = {id: 7, root: 'ر ح م', words: 339, ayahs: 313};

function rootDone(hits: QuranVerseHit[]): QuranSearchState {
  return {
    status: 'done',
    outcome: {
      kind: 'root',
      letters: 'رحم',
      candidates: [RAHMA],
      result: {
        root: RAHMA,
        lemmas: [{id: 1, rootId: 7, lemma: 'رَحِيم', words: 116, ayahs: 114}],
        hits: () => hits,
      },
    },
  };
}

const onQueryChange = jest.fn();
let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

function view(query: string) {
  return (
    <SearchView
      visible
      onClose={jest.fn()}
      query={query}
      isSearchActive
      onQueryChange={onQueryChange}
    />
  );
}

/** Renders with `query` once the catalogue has loaded and the debounce ran. */
async function open(query: string): Promise<TestRenderer.ReactTestRenderer> {
  await act(async () => {
    renderer = TestRenderer.create(view(''));
  });
  await act(async () => {
    renderer?.update(view(query));
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  if (!renderer) throw new Error('not rendered');
  return renderer;
}

async function retype(query: string) {
  await act(async () => {
    renderer?.update(view(query));
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

/** The rows on screen, in order: "<testID>|<text>". */
function rows(): string[] {
  const text: unknown = Text;
  return (
    renderer?.root.findAll(
      n => n.type === text && typeof n.props.testID === 'string',
    ) ?? []
  ).map(n => `${n.props.testID}|${n.props.children}`);
}

function press(testID: string, label: string) {
  const text: unknown = Text;
  const node = renderer?.root.find(
    n =>
      n.type === text &&
      n.props.testID === testID &&
      n.props.children === label,
  );
  act(() => node?.props.onPress());
}

function screenText(): string {
  const text: unknown = Text;
  return (renderer?.root.findAll(n => n.type === text) ?? [])
    .map(n => [n.props.children].flat().join(''))
    .join('\n');
}

beforeEach(async () => {
  jest.useFakeTimers();
  mockCatalog.clear();
  mockCatalogQueries.length = 0;
  mockQuranStates.clear();
  mockQuranCalls.length = 0;
  mockPush.mockClear();
  onQueryChange.mockClear();
  mockRewayah = 'hafs';
  mockTablet = false;
  mockTabletRows.length = 0;
  await AsyncStorage.clear();
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
  jest.useRealTimers();
});

describe('SearchView: Quran results', () => {
  it('lists the catalogue rows, then the Ayahs header, then the ayahs', async () => {
    mockCatalog.set('الرحمن', [
      {type: 'surah', item: {id: 55, name: 'Ar-Rahman'}},
    ]);
    mockQuranStates.set('الرحمن', textDone([hit('1:1', 3), hit('1:3', 1)]));
    await open('الرحمن');
    expect(rows()).toEqual([
      'catalog-row|Ar-Rahman',
      'quran-row|quran-header:none',
      'quran-row|quran-verse-1:1',
      'quran-row|quran-verse-1:3',
    ]);
  });

  it('says the results are the Hafs text when another rewayah is read', async () => {
    mockRewayah = 'warsh';
    mockQuranStates.set('الرحمن', textDone([hit('1:1', 3)]));
    await open('الرحمن');
    expect(rows()).toContain('quran-row|quran-header:hafs');
  });

  it('leaves the Quran search off for a Latin query', async () => {
    mockCatalog.set('husary', [
      {type: 'reciter', item: {id: 'h', name: 'Mahmoud Khalil Al-Husary'}},
    ]);
    await open('husary');
    expect(rows()).toEqual(['catalog-row|Mahmoud Khalil Al-Husary']);
    expect(mockQuranCalls.length).toBeGreaterThan(0);
    expect(mockQuranCalls.every(call => call.enabled === false)).toBe(true);
  });

  it('searches the Arabic-layout letters of a Latin query the catalogue cannot match', async () => {
    // "hgpl]" is الحمد typed on a US keyboard.
    mockQuranStates.set('الحمد', textDone([hit('1:2', 1)]));
    await open('hgpl]');
    expect(mockQuranCalls).toContainEqual({query: 'الحمد', enabled: true});
    expect(rows()).toEqual([
      'quran-row|quran-header:none',
      'quran-row|quran-verse-1:2',
    ]);
  });

  it('lists only the root for a root query, without catalogue rows', async () => {
    mockCatalog.set('root:رحم', [
      {type: 'surah', item: {id: 55, name: 'Ar-Rahman'}},
    ]);
    mockQuranStates.set('root:رحم', rootDone([hit('1:1', 3)]));
    await open('root:رحم');
    expect(mockCatalogQueries).not.toContain('root:رحم');
    expect(rows()).toEqual([
      'quran-row|quran-root-7',
      'quran-row|quran-lemmas-7',
      'quran-row|quran-verse-1:1',
    ]);
  });

  it('opens a root suggestion as a root query', async () => {
    mockQuranStates.set('رحم', textDone([hit('19:21', 5)], [RAHMA]));
    await open('رحم');
    press('quran-row', 'quran-root-suggestion-7');
    expect(onQueryChange).toHaveBeenCalledWith('root:ر ح م');
  });

  it('opens a verse on its matched words and remembers it', async () => {
    mockQuranStates.set('الله لا اله', textDone([hit('2:255', 3, 2)]));
    await open('الله لا اله');
    press('quran-row', 'quran-verse-2:255');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/mushaf',
      params: {
        surah: '2',
        ayah: '255',
        page: '42',
        anchor: '2:255:3',
        words: '3,4',
      },
    });
    await act(async () => undefined);
    const stored = JSON.parse(
      (await AsyncStorage.getItem('recentSearches')) ?? '[]',
    );
    expect(stored).toEqual([
      {
        type: 'verse',
        verseKey: '2:255',
        positions: [3, 4],
        timestamp: expect.any(Number),
      },
    ]);

    // The recent searches list it, and it opens the same way.
    await retype('');
    expect(rows()).toEqual(['recent-verse|2:255']);
    mockPush.mockClear();
    press('recent-verse', '2:255');
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mushaf',
        params: expect.objectContaining({anchor: '2:255:3', words: '3,4'}),
      }),
    );
  });

  it('iPad: Quran rows alone open the tablet results; a root keeps the list', async () => {
    mockTablet = true;
    mockQuranStates.set('الحمد لله', textDone([hit('1:2', 1, 2)]));
    await open('الحمد لله');
    expect(mockTabletRows[mockTabletRows.length - 1]).toHaveLength(2);
    expect(rows()).toEqual([]);

    mockQuranStates.set('root:رحم', rootDone([hit('1:1', 3)]));
    await retype('root:رحم');
    expect(rows()).toEqual([
      'quran-row|quran-root-7',
      'quran-row|quran-lemmas-7',
      'quran-row|quran-verse-1:1',
    ]);
  });

  it('shows the empty state only when both searches are empty', async () => {
    mockCatalog.set('الرحمن', [
      {type: 'surah', item: {id: 55, name: 'Ar-Rahman'}},
    ]);
    mockQuranStates.set('الرحمن', textDone([]));
    await open('الرحمن');
    expect(screenText()).not.toContain('No results');

    mockQuranStates.set('ابرهيمز', textDone([]));
    await retype('ابرهيمز');
    expect(rows()).toEqual([]);
    expect(screenText()).toContain('No results');
    expect(screenText()).toContain('Try fewer words or another spelling');

    await retype('zzzz');
    expect(screenText()).toContain('No results');
    expect(screenText()).toContain(
      'Try different keywords or check the spelling',
    );
  });
});
