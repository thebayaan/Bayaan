// @ai-generated
/**
 * Every search surface treats a query as the data service's outcome says,
 * on the bundled index: the real useQuranSearch hook and
 * QuranSearchDataService (a copy of assets/data/quran-search-v1.db), driving
 * the Search tab (phone and iPad) and the mushaf search. The service parses
 * each query once, with its root list, and no surface parses it again, so
 * ر ح م is a root everywhere (the root's words only), ا ل م the opening الم
 * everywhere (its six ayahs, the root ء ل م as a suggestion), and 2:255 or
 * a reciter's name never a Quran query (utils/search/__fixtures__/
 * quranSearchGolden.ts, QURAN_KIND_FIXTURES).
 *
 * The catalogue (Search tab) and the surah ranking (mushaf) match every
 * query here, so whether their rows show depends only on the kind.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import type {QuranResultRow} from '@/components/search/quran/quranResultRows';
import {
  QURAN_KIND_FIXTURES,
  type QuranKindFixture,
} from '@/utils/search/__fixtures__/quranSearchGolden';

jest.mock('expo-sqlite', () => ({}));
// The app's service instance, on a temp copy of the bundled index.
jest.mock('@/services/search/QuranSearchDataService', () => {
  const fs = jest.requireActual('fs');
  const os = jest.requireActual('os');
  const path = jest.requireActual('path');
  const actual = jest.requireActual('@/services/search/QuranSearchDataService');
  const {QURAN_SEARCH_DB_NAME} = jest.requireActual(
    '@/utils/search/quranIndexFormat',
  );
  const {openAdapterDatabase} = jest.requireActual(
    '@/test-utils/sqliteAdapter',
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quran-surfaces-'));
  const copy = path.join(dir, QURAN_SEARCH_DB_NAME);
  fs.copyFileSync(
    path.join(__dirname, '../../../assets/data', QURAN_SEARCH_DB_NAME),
    copy,
  );
  return {
    ...actual,
    mockIndexDir: dir,
    quranSearchDataService: actual.createQuranSearchDataService(async () =>
      openAdapterDatabase(copy),
    ),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({useRouter: () => ({push: jest.fn()})}));
jest.mock('expo-router/react-navigation', () => ({useHeaderHeight: () => 0}));

// Every query matches one catalogue row and one surah.
jest.mock('@/utils/search/catalog', () => {
  const {SURAHS} = jest.requireActual('@/data/surahData');
  return {
    createCatalogSearch: () => ({
      search: () => [{type: 'surah', item: SURAHS[0], score: 1}],
    }),
    rankSurahs: () => [SURAHS[0]],
  };
});
jest.mock('@/services/dataService', () => ({
  getAllReciters: async () => [],
  getAllSurahs: async () => [],
}));

// Rows render as elements that carry their props.
jest.mock('@/components/search/quran/QuranResultRowView', () => {
  const ReactActual = jest.requireActual('react');
  return {
    QuranResultRowView: (props: Record<string, unknown>) =>
      ReactActual.createElement('QuranResultRowView', props),
  };
});
jest.mock('@/components/search/TabletSearchResults', () => {
  const ReactActual = jest.requireActual('react');
  return {
    TabletSearchResults: (props: Record<string, unknown>) =>
      ReactActual.createElement('TabletSearchResults', props),
  };
});
jest.mock('@/components/SurahItem', () => {
  const ReactActual = jest.requireActual('react');
  return {
    SurahItem: (props: Record<string, unknown>) =>
      ReactActual.createElement('SurahItem', props),
  };
});
jest.mock('@/components/ReciterItem', () => ({ReciterItem: () => null}));
jest.mock('@/components/search/quran/RecentVerseRow', () => ({
  RecentVerseRow: () => null,
}));
jest.mock('@/components/search/ReciteToSearchRow', () => ({
  ReciteToSearchRow: () => null,
}));
jest.mock('@/components/search/ExploreView', () => ({ExploreView: () => null}));
jest.mock('@/components/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));
jest.mock('@/components/sheets/options/surahOptions', () => ({
  SurahOptionsProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('@/components/SearchInput', () => {
  const ReactActual = jest.requireActual('react');
  return {
    SearchInput: ReactActual.forwardRef(
      (props: Record<string, unknown>, _ref: unknown) =>
        ReactActual.createElement('SearchInput', props),
    ),
  };
});
jest.mock('@/components/mushaf/BookmarkChips', () => ({
  BookmarkChips: () => null,
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ListHeaderComponent}: {ListHeaderComponent?: unknown}) =>
    ListHeaderComponent ?? null,
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    rewayah: 'hafs',
    getPageForVerse: () => 1,
    getPageForWord: () => 1,
  },
}));
jest.mock('@/hooks/useRewayahVerseUnits', () => ({
  useRewayahVerseUnits: () => ({units: null, status: 'unavailable'}),
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: () => null}),
}));
jest.mock('@/services/verse-annotations/restoreSavedRewayah', () => ({
  restoreSavedRewayah: async () => undefined,
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#000000', textSecondary: '#666666', background: '#fff'},
      fonts: {bold: 'b', semiBold: 's', medium: 'm', regular: 'r'},
    },
    isDarkMode: false,
  }),
}));
jest.mock('@/hooks/useSettings', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useSettings: create(() => ({
      askEveryTime: true,
      defaultReciterSelection: 'ask',
      browseSortOption: 'asc',
      setBrowseSortOption: () => undefined,
    })),
  };
});
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
import MushafSearchView from '@/components/mushaf/MushafSearchView';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;
jest.setTimeout(60_000);

const service = jest.requireMock(
  '@/services/search/QuranSearchDataService',
) as {
  mockIndexDir: string;
  quranSearchDataService: {
    initialize(): Promise<void>;
    findRoot(root: string): {id: number} | null;
  };
};

/** The six openings الم (2:1 ...), one hit each. */
const ALIF_LAM_MIM = ['2:1', '3:1', '29:1', '30:1', '31:1', '32:1'];

let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

beforeAll(async () => {
  await service.quranSearchDataService.initialize();
});
afterAll(() => {
  const fs = jest.requireActual('fs');
  fs.rmSync(service.mockIndexDir, {recursive: true, force: true});
});

beforeEach(() => {
  jest.useFakeTimers({doNotFake: ['nextTick', 'setImmediate']});
  mockTablet = false;
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
  jest.useRealTimers();
});

/** Lets the debounce pass and the service answer (SQL runs in promises). */
async function settle(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve));
    });
  }
}

function quranRowsOf(
  root: TestRenderer.ReactTestInstance,
): readonly QuranResultRow[] {
  return root
    .findAll(n => (n.type as unknown) === 'QuranResultRowView')
    .map(n => n.props.row as QuranResultRow);
}

/**
 * What the rows say about the query: its kind and its roots. A row of a
 * search that has not answered (loading, error) is reported as its kind, so
 * it never passes for text.
 */
function readRows(rows: readonly QuranResultRow[]): {
  kind: QuranKindFixture['kind'] | QuranResultRow['type'];
  roots: string[];
  verses: string[];
} {
  const unsettled = rows.find(
    row => row.type === 'quran-loading' || row.type === 'quran-error',
  );
  if (unsettled) return {kind: unsettled.type, roots: [], verses: []};
  const header = rows.find(row => row.type === 'quran-root-header');
  if (header && header.type === 'quran-root-header') {
    const others = rows.flatMap(row =>
      row.type === 'quran-root-suggestion' ? [row.root.root] : [],
    );
    return {
      kind: 'root',
      roots: [header.root.root, ...others],
      verses: rows.flatMap(row =>
        row.type === 'quran-verse' ? [row.hit.verseKey] : [],
      ),
    };
  }
  return {
    kind: rows.length ? 'text' : 'none',
    roots: rows.flatMap(row =>
      row.type === 'quran-root-suggestion' ? [row.root.root] : [],
    ),
    verses: rows.flatMap(row =>
      row.type === 'quran-verse' ? [row.hit.verseKey] : [],
    ),
  };
}

function searchTab(query: string) {
  return (
    <SearchView
      visible
      onClose={jest.fn()}
      query={query}
      isSearchActive
      onQueryChange={jest.fn()}
    />
  );
}

/** The Search tab with `query`, once the catalogue loaded and both ran. */
async function openSearchTab(query: string) {
  await act(async () => {
    renderer = TestRenderer.create(searchTab(''));
  });
  await act(async () => {
    renderer?.update(searchTab(query));
  });
  await settle(300);
  const root = (renderer as TestRenderer.ReactTestRenderer).root;
  const tablet = root.findAll(
    n => (n.type as unknown) === 'TabletSearchResults',
  );
  const catalogueRows = root.findAll(
    n => (n.type as unknown) === 'SurahItem',
  ).length;
  const rows = tablet.length
    ? (tablet[0].props.quranRows as QuranResultRow[])
    : quranRowsOf(root);
  return {tablet: tablet.length > 0, catalogueRows, ...readRows(rows)};
}

/** The mushaf search with `query` typed, once the Quran search answered. */
async function openMushafSearch(query: string) {
  await act(async () => {
    renderer = TestRenderer.create(
      <MushafSearchView
        onNavigateToPage={jest.fn()}
        onResumeChain={jest.fn()}
        onNavigateToSurah={jest.fn()}
        onNavigateToVerse={jest.fn()}
        onClose={jest.fn()}
        surahStartPages={{}}
        pageToSurah={{}}
        autoFocusSearch
      />,
    );
  });
  const root = (renderer as TestRenderer.ReactTestRenderer).root;
  const input = root.find(
    n => (n.type as unknown) === 'SearchInput' && n.props.editable !== false,
  );
  await act(async () => {
    (input.props.onChangeText as (text: string) => void)(query);
  });
  await settle(250);
  const [list] = root.findAll(
    n =>
      Array.isArray(n.props.data) &&
      typeof n.props.renderItem === 'function' &&
      n.props.ListEmptyComponent !== undefined,
  );
  const data = list.props.data as {type: string}[];
  const commandRows = data.filter(item => !item.type.startsWith('quran-'));
  const rows = data.filter((item): item is QuranResultRow =>
    item.type.startsWith('quran-'),
  );
  return {commandRows: commandRows.length, ...readRows(rows)};
}

describe.each(QURAN_KIND_FIXTURES.map(f => [f.query, f] as const))(
  '%s',
  (_query, fixture) => {
    const expected = {kind: fixture.kind, roots: [...fixture.roots]};

    it('Search tab (phone)', async () => {
      const shown = await openSearchTab(fixture.query);
      expect({kind: shown.kind, roots: shown.roots}).toEqual(expected);
      // A root lists its words only; text and other queries keep the
      // catalogue.
      expect(shown.catalogueRows).toBe(fixture.kind === 'root' ? 0 : 1);
      expect(shown.tablet).toBe(false);
      if (fixture.query === 'ا ل م') expect(shown.verses).toEqual(ALIF_LAM_MIM);
    });

    it('Search tab (iPad)', async () => {
      mockTablet = true;
      const shown = await openSearchTab(fixture.query);
      expect({kind: shown.kind, roots: shown.roots}).toEqual(expected);
      // A root keeps the list; the tablet results never show root rows.
      expect(shown.tablet).toBe(fixture.kind !== 'root');
      if (fixture.query === 'ا ل م') expect(shown.verses).toEqual(ALIF_LAM_MIM);
    });

    it('mushaf search', async () => {
      const shown = await openMushafSearch(fixture.query);
      expect({kind: shown.kind, roots: shown.roots}).toEqual(expected);
      expect(shown.commandRows).toBe(fixture.kind === 'root' ? 0 : 1);
      if (fixture.query === 'ا ل م') expect(shown.verses).toEqual(ALIF_LAM_MIM);
    });
  },
);

it('lists the root the service found, with its lemmas', async () => {
  const rahma = service.quranSearchDataService.findRoot('ر ح م');
  expect(rahma).not.toBeNull();
  await openSearchTab('ر ح م');
  const rows = quranRowsOf((renderer as TestRenderer.ReactTestRenderer).root);
  expect(rows.slice(0, 2).map(row => row.key)).toEqual([
    `quran-root-${rahma?.id}`,
    `quran-lemmas-${rahma?.id}`,
  ]);
});
