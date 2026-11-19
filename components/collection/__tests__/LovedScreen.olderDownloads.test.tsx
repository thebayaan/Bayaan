/**
 * Collection → Loved, for a surah loved before rewayat were saved and
 * downloaded by an older version. That download is recorded under an empty
 * rewayah (''). The row plays the reciter's first rewayah, and playback uses
 * the '' file for it (findDownloadForPlayback), so the row's badge, the
 * "All Downloaded" state, "Download all" and the row's surah menu must count
 * it too. They checked the first rewayah only: the badge went missing and
 * "Download all" fetched a second copy.
 *
 * Runs the real chain: the screen, TrackItem, the download store and its
 * selectors, useCollectionDownloadState, bulkDownloadSurahs and the surah
 * options. Only the network download and UI leaves are mocked.
 */
import React from 'react';
import {Alert} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

interface Loved {
  reciterId: string;
  surahId: string;
  rewayatId: string;
  timestamp: number;
  userRecitationId?: string;
}

let mockLovedTracks: Loved[] = [];
const mockShowSheet = jest.fn();
const mockDownloadSurah = jest.fn();
const mockUpdateQueue = jest.fn();

// Catalogue order: a download recorded without a rewayah holds rw-first.
const mockReciter = {
  id: 'reciter-1',
  name: 'Reciter 1',
  image_url: '',
  rewayat: [
    {id: 'rw-first', name: "Hafs A'n Assem", style: 'murattal'},
    {id: 'rw-second', name: "Warsh A'n Nafi'", style: 'murattal'},
  ],
};

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackDownloadCompleted: jest.fn(),
    trackDownloadStarted: jest.fn(),
  },
}));
jest.mock('@/services/downloadService', () => ({
  downloadSurah: (...args: unknown[]) => mockDownloadSurah(...args),
  clearAllDownloads: jest.fn(async () => undefined),
  removeDownload: jest.fn(async () => undefined),
  extractFilename: (path: string) => path,
  resolveFilePath: (path: string) => `/docs/${path}`,
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) =>
    id === 'reciter-1' ? mockReciter : undefined,
  getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
}));
jest.mock('@/hooks/useLoved', () => ({
  useLoved: () => ({
    lovedTracks: mockLovedTracks,
    toggleLoved: jest.fn(),
    unloveAll: jest.fn(),
    isLoved: () => true,
    isLovedWithRewayat: () => true,
  }),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({
    addToQueue: jest.fn(),
    updateQueue: mockUpdateQueue,
    play: jest.fn(),
    toggleShuffle: jest.fn(),
  }),
}));
jest.mock('@/hooks/useReciterNavigation', () => ({
  useReciterNavigation: () => ({navigateToReciterProfile: jest.fn()}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111',
        textSecondary: '#555',
        background: '#fff',
        card: '#eee',
      },
      fonts: {regular: 'r', semiBold: 's', bold: 'b'},
    },
  }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false, width: 390}),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({
  useLibraryListBottomPadding: () => 0,
}));
jest.mock('@/hooks/useCollectionNativeHeader', () => ({
  useCollectionNativeHeader: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('expo-router', () => ({useRouter: () => ({back: jest.fn()})}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: () => jest.fn(),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (state: unknown) => unknown) =>
    select({
      playback: {state: 'paused'},
      queue: {tracks: [], currentIndex: 0},
      settings: {shuffle: false},
    }),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({recitations: []})},
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => ''}));
jest.mock('@/utils/shareUtils', () => ({
  recitationShareUrl: jest.fn(),
  shareUrl: jest.fn(),
}));
jest.mock('@/utils/confirmDestructive', () => ({
  confirmDestructive: jest.fn(),
}));
jest.mock('@/i18n/format', () => ({
  getReciterDisplayName: (reciter: {name: string}) => reciter.name,
  getSurahDisplayName: (surah: {name: string}) => surah.name,
  localizeDigits: (value: number | string) => String(value),
}));
jest.mock('@/components/Icons', () => ({
  HeartIcon: () => null,
  CheckIcon: () => null,
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/CircularProgress', () => ({
  CircularProgress: () => null,
}));
jest.mock('@/components/GradientText', () => ({GradientText: () => null}));
jest.mock('@/components/NowPlayingIndicator', () => ({
  NowPlayingIndicator: () => null,
}));
jest.mock('@/components/playlist-detail/LovedHeader', () => ({
  LovedHeader: () => null,
}));
jest.mock('@/components/collection/CollectionStickyHeader', () => ({
  CollectionStickyHeader: () => null,
}));
jest.mock('@/components/sheets/options/collectionOptions', () => ({
  CollectionOptionsMenu: ({children}: {children?: React.ReactNode}) =>
    children ?? null,
}));
// Phones: the surah options open as a sheet, not a native menu.
jest.mock('@/components/sheets/options/OptionsMenu', () => ({
  useNativeOptionsMenu: () => false,
  OptionsMenuView: () => null,
}));
jest.mock('@/components/sheets/options/downloadFailedToast', () => ({
  showDownloadFailedToast: jest.fn(),
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    show: (id: string, options: unknown) => mockShowSheet(id, options),
  },
}));

import {RECITERS, type Reciter} from '@/data/reciterData';
import {
  useDownloadStore,
  type DownloadedSurah,
} from '@/services/player/store/downloadStore';
import {
  useSurahOptions,
  type SurahOptionsPayload,
} from '@/components/sheets/options/surahOptions';
import LovedScreen from '@/app/(tabs)/(c.collection)/collection/loved';
import {LovedHeader} from '@/components/playlist-detail/LovedHeader';

// The first render loads React Native's list modules; on a cold transform
// cache that alone can pass Jest's 5 s default.
jest.setTimeout(30000);

/** A completed download record as an older version saved it. */
const download = (surahId: string, rewayatId: string): DownloadedSurah => ({
  reciterId: 'reciter-1',
  surahId,
  rewayatId,
  filePath: rewayatId
    ? `00${surahId}_reciter-1_${rewayatId}.mp3`
    : `00${surahId}_reciter-1.mp3`,
  fileSize: 10,
  downloadDate: 1,
  status: 'completed',
});

const loved = (surahId: string, rewayatId: string): Loved => ({
  reciterId: 'reciter-1',
  surahId,
  rewayatId,
  timestamp: 1,
});

let mounted: TestRenderer.ReactTestRenderer[] = [];

function render(
  element: Parameters<typeof TestRenderer.create>[0],
): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  mounted.push(tree);
  return tree;
}

/** The Loved rows, by the props the screen gives TrackItem. */
const rows = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      node.props.reciterId === 'reciter-1' &&
      typeof node.props.onOptionsPress === 'function' &&
      typeof node.props.onPlayPress === 'function',
  );

/** TrackItem's downloaded badge. */
const badges = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll(
    node =>
      typeof node.type !== 'string' && node.props.name === 'arrow-down-circle',
  ).length;

/** The options of the screen's ••• menu. */
function screenOptions(tree: TestRenderer.ReactTestRenderer) {
  const header = tree.root.find(node => (node.type as unknown) === LovedHeader);
  act(() => {
    header.props.onOptionsPress();
  });
  const [, {payload}] = mockShowSheet.mock.calls[
    mockShowSheet.mock.calls.length - 1
  ] as [string, {payload: {options: unknown}}];
  return payload.options as Array<{
    label: string;
    disabled?: boolean;
    onPress: () => Promise<void>;
  }>;
}

/** Whether the row's surah options (sheet or menu) say it is downloaded. */
function rowMenuSaysDownloaded(row: TestRenderer.ReactTestInstance): boolean {
  act(() => {
    row.props.onOptionsPress();
  });
  const [id, {payload}] = mockShowSheet.mock.calls[
    mockShowSheet.mock.calls.length - 1
  ] as [string, {payload: SurahOptionsPayload}];
  expect(id).toBe('surah-options');

  let downloaded: boolean | undefined;
  function Options() {
    downloaded = useSurahOptions(payload, () => undefined).isTrackDownloaded;
    return null;
  }
  render(<Options />);
  return downloaded === true;
}

const recordsOf = (surahId: string) =>
  useDownloadStore
    .getState()
    .downloads.filter(d => d.reciterId === 'reciter-1' && d.surahId === surahId)
    .map(d => d.rewayatId);

let alert: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  RECITERS.splice(0, RECITERS.length, mockReciter as unknown as Reciter);
  mockDownloadSurah.mockImplementation(
    async (surahId: number, reciterId: string, rewayatId?: string) => ({
      filePath: `00${surahId}_${reciterId}_${rewayatId}.mp3`,
      fileSize: 10,
    }),
  );
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => {
    mounted.forEach(tree => tree.unmount());
  });
  mounted = [];
  alert.mockRestore();
  RECITERS.splice(0, RECITERS.length);
});

describe('a surah loved without a rewayah, downloaded under ""', () => {
  beforeEach(() => {
    useDownloadStore.setState({
      downloads: [download('2', '')],
      downloading: [],
      downloadProgress: {},
    });
    mockLovedTracks = [loved('2', '')];
  });

  it('shows the downloaded badge on its row, which plays that file', async () => {
    const tree = render(<LovedScreen />);

    // The row plays the reciter's first rewayah, and so does the '' file.
    expect(rows(tree)[0].props.rewayatId).toBe('rw-first');
    expect(badges(tree)).toBe(1);

    await act(async () => {
      await rows(tree)[0].props.onPress();
    });
    expect(mockUpdateQueue.mock.calls[0][0][0]).toMatchObject({
      rewayatId: 'rw-first',
      url: '/docs/002_reciter-1.mp3',
    });
  });

  it('counts as downloaded in the ••• menu', () => {
    const tree = render(<LovedScreen />);

    const [option] = screenOptions(tree);
    expect(option.label).toBe('All Downloaded');
    expect(option.disabled).toBe(true);
  });

  it("is downloaded in the row's surah options", () => {
    const tree = render(<LovedScreen />);

    // Its "Download" used to be enabled and fetched a second copy.
    expect(rowMenuSaysDownloaded(rows(tree)[0])).toBe(true);
  });

  it('is not fetched again by "Download all"', async () => {
    // Another loved surah that is not downloaded keeps "Download All" on.
    mockLovedTracks = [loved('2', ''), loved('3', 'rw-first')];
    const tree = render(<LovedScreen />);

    const [option] = screenOptions(tree);
    expect(option.label).toBe('Download All');
    await act(async () => {
      await option.onPress();
    });

    expect(mockDownloadSurah).toHaveBeenCalledTimes(1);
    expect(mockDownloadSurah.mock.calls[0].slice(0, 3)).toEqual([
      3,
      'reciter-1',
      'rw-first',
    ]);
    // No second record (and file) next to the old one.
    expect(recordsOf('2')).toEqual(['']);
    expect(alert).toHaveBeenCalledWith(
      'Download Complete',
      'All loved surahs have been downloaded.',
    );
  });
});

describe('a download without a rewayah, for a row in another rewayah', () => {
  beforeEach(() => {
    useDownloadStore.setState({
      downloads: [download('2', '')],
      downloading: [],
      downloadProgress: {},
    });
    // The '' file holds rw-first, so it never plays for rw-second.
    mockLovedTracks = [loved('2', 'rw-second')];
  });

  it('does not count, so the badge and the menus offer the download', () => {
    const tree = render(<LovedScreen />);

    expect(badges(tree)).toBe(0);
    expect(screenOptions(tree)[0].label).toBe('Download All');
    expect(rowMenuSaysDownloaded(rows(tree)[0])).toBe(false);
  });

  it('is fetched by "Download all"', async () => {
    const tree = render(<LovedScreen />);

    await act(async () => {
      await screenOptions(tree)[0].onPress();
    });

    expect(mockDownloadSurah.mock.calls.map(call => call.slice(0, 3))).toEqual([
      [2, 'reciter-1', 'rw-second'],
    ]);
    expect(recordsOf('2')).toEqual(['', 'rw-second']);
  });
});
