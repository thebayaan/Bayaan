// @ai-generated
/**
 * Search is debounced and builds its index on first use. While the results
 * are not yet for what was typed, the list shows a spinner. It used to say
 * "No results" for that time, on every first keystroke.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

let mockLoadReciters: () => Promise<unknown[]> = async () => [];
jest.mock('@/services/dataService', () => ({
  getAllReciters: () => mockLoadReciters(),
  getAllSurahs: async () => [],
}));
// Finds one reciter for anything starting with "m".
jest.mock('@/utils/search/catalog', () => ({
  createCatalogSearch: () => ({
    search: (query: string) =>
      query.startsWith('m')
        ? [{type: 'reciter', item: {id: 'r1', name: 'Mishary'}, score: 1}]
        : [],
  }),
}));
jest.mock('@/components/LoadingIndicator', () => ({
  LoadingIndicator: () => 'spinner',
}));
jest.mock('@/components/ReciterItem', () => ({
  ReciterItem: ({item}: {item: {name: string}}) => `reciter:${item.name}`,
}));
jest.mock('@/components/SurahItem', () => ({SurahItem: () => null}));
jest.mock('@/components/search/ExploreView', () => ({ExploreView: () => null}));
jest.mock('@/components/search/ReciteToSearchRow', () => ({
  ReciteToSearchRow: () => null,
}));
jest.mock('@/components/search/TabletSearchResults', () => ({
  TabletSearchResults: () => null,
}));
jest.mock('@/components/sheets/options/surahOptions', () => ({
  SurahOptionsProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('react-native-actions-sheet', () => ({SheetManager: {}}));
jest.mock('expo-router', () => ({
  useRouter: () => ({push: jest.fn()}),
  useNavigationContainerRef: () => ({isReady: () => false}),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// The Ayahs search stays idle: these cases are about the catalogue.
jest.mock('expo-sqlite', () => ({}));
jest.mock('@/hooks/useQuranSearch', () => {
  const {isQuranQuery, mayBeRootQuery} = jest.requireActual(
    '@/services/search/QuranSearchDataService',
  );
  return {
    useQuranSearch: () => ({status: 'idle'}),
    isQuranQuery,
    mayBeRootQuery,
    prefetchQuranSearch: jest.fn(),
  };
});
jest.mock('@/components/search/quran/QuranResultRowView', () => ({
  QuranResultRowView: () => null,
}));
jest.mock('@/components/search/quran/RecentVerseRow', () => ({
  RecentVerseRow: () => null,
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (select: (s: {rewayah: string}) => unknown) =>
    select({rewayah: 'hafs'}),
}));
jest.mock('expo-router/react-navigation', () => ({useHeaderHeight: () => 0}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({askEveryTime: true, defaultReciterSelection: null}),
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: (select: (state: unknown) => unknown) =>
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
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        textSecondary: '#666666',
        background: '#ffffff',
      },
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackSearchPerformed: jest.fn()},
}));

import {SearchView} from '../SearchView';

const NO_RESULTS = 'No results';

function render(query: string) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <SearchView visible onClose={jest.fn()} query={query} isSearchActive />,
    );
  });
  return renderer;
}

type Rendered =
  | TestRenderer.ReactTestRendererNode
  | TestRenderer.ReactTestRendererNode[]
  | null;

/** Every piece of text on screen, joined. */
function shown(renderer: TestRenderer.ReactTestRenderer): string {
  const texts: string[] = [];
  const walk = (node: Rendered) => {
    if (node === null) return;
    if (typeof node === 'string') texts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else walk(node.children);
  };
  walk(renderer.toJSON());
  return texts.join('|');
}

/** Lets the index finish loading (or failing). */
async function settleIndex() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Lets the typed query reach the search. */
function passDebounce() {
  act(() => {
    jest.advanceTimersByTime(300);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockLoadReciters = async () => [];
});
afterEach(() => jest.useRealTimers());

it('shows a spinner, not "No results", before the first search has run', async () => {
  const renderer = render('m');
  await settleIndex();

  expect(shown(renderer)).toContain('spinner');
  expect(shown(renderer)).not.toContain(NO_RESULTS);
});

it('shows the results once the search has run', async () => {
  const renderer = render('m');
  await settleIndex();
  passDebounce();

  expect(shown(renderer)).toContain('reciter:Mishary');
  expect(shown(renderer)).not.toContain('spinner');
  expect(shown(renderer)).not.toContain(NO_RESULTS);
});

it('says "No results" only once the search found nothing', async () => {
  const renderer = render('zz');
  await settleIndex();
  expect(shown(renderer)).not.toContain(NO_RESULTS);

  passDebounce();
  expect(shown(renderer)).toContain(NO_RESULTS);
  expect(shown(renderer)).not.toContain('spinner');
});

it('keeps the spinner while the index is still loading', async () => {
  let finishLoading!: (reciters: unknown[]) => void;
  mockLoadReciters = () =>
    new Promise(resolve => {
      finishLoading = resolve;
    });
  const renderer = render('m');
  passDebounce();

  expect(shown(renderer)).toContain('spinner');
  expect(shown(renderer)).not.toContain(NO_RESULTS);

  await act(async () => {
    finishLoading([]);
  });
  await settleIndex();
  expect(shown(renderer)).toContain('reciter:Mishary');
});

it('does not spin forever when the index cannot be loaded', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockLoadReciters = async () => {
    throw new Error('offline');
  };
  const renderer = render('m');
  await settleIndex();
  passDebounce();

  expect(shown(renderer)).toContain(NO_RESULTS);
  expect(shown(renderer)).not.toContain('spinner');
  error.mockRestore();
});

it('keeps the previous results on screen while a new query is typed', async () => {
  const renderer = render('m');
  await settleIndex();
  passDebounce();

  act(() => {
    renderer.update(
      <SearchView visible onClose={jest.fn()} query="mi" isSearchActive />,
    );
  });

  expect(shown(renderer)).toContain('reciter:Mishary');
  expect(shown(renderer)).not.toContain('spinner');
});
