// @ai-generated
/**
 * Collection → Loved. The route lives in app/, so its test lives here.
 *
 * - Tapping the Nth surah rotated the queue to start with it, so Previous
 *   could not reach the surahs above it.
 * - Unloving a surah blanked the whole screen to "Loading…" and threw the
 *   list back to the top.
 * - "Download all" saved surahs loved without a rewayah under a key playback
 *   never looks up, downloaded the catalogue recording for uploads, and
 *   always said "Download Complete".
 */
import React from 'react';
import {Alert, Animated, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

interface Loved {
  reciterId: string;
  surahId: string;
  rewayatId: string;
  timestamp: number;
  userRecitationId?: string;
}

let mockLovedTracks: Loved[] = [];
let mockUploads: Array<{id: string}> = [];
const mockUpdateQueue = jest.fn();
const mockStartNewChain = jest.fn();
const mockShowSheet = jest.fn();
const mockDownloadState = jest.fn();
const mockDownloadSurah = jest.fn();
const mockAddDownload = jest.fn();
/** `${reciterId}:${surahId}:${rewayatId}` of what is already downloaded. */
let mockDownloaded = new Set<string>();

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#111', textSecondary: '#555', background: '#fff'},
      fonts: {regular: 'r', semiBold: 's', bold: 'b'},
    },
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({
  useLibraryListBottomPadding: () => 0,
}));
jest.mock('@/hooks/useCollectionNativeHeader', () => ({
  useCollectionNativeHeader: () => undefined,
}));
jest.mock('@/hooks/useCollectionDownloadState', () => ({
  useCollectionDownloadState: (items: unknown) => {
    mockDownloadState(items);
    return {allDownloaded: false, hasNoTracks: false};
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('expo-router', () => ({useRouter: () => ({back: jest.fn()})}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useLoved', () => ({
  useLoved: () => ({
    lovedTracks: mockLovedTracks,
    toggleLoved: jest.fn(),
    unloveAll: jest.fn(),
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
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) => ({
    id,
    name: `Reciter ${id}`,
    rewayat: [{id: `${id}-default`}],
  }),
  getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: () => mockStartNewChain,
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: () => false,
}));
jest.mock('@/services/player/store/downloadSelectors', () => ({
  useDownloadQueries: () => ({
    isDownloaded: (reciterId: string, surahId: string) =>
      mockDownloaded.has(`${reciterId}:${surahId}:`),
    // The store's rule: the rewayah's own download, or, for the reciter's
    // first rewayah, one recorded without a rewayah.
    isDownloadedForPlayback: (
      reciterId: string,
      surahId: string,
      rewayatId = '',
    ) =>
      mockDownloaded.has(`${reciterId}:${surahId}:${rewayatId}`) ||
      (rewayatId === `${reciterId}-default` &&
        mockDownloaded.has(`${reciterId}:${surahId}:`)),
    isDownloading: () => false,
    isDownloadingWithRewayat: () => false,
  }),
  useDownloadActions: () => ({
    setDownloading: jest.fn(),
    clearDownloading: jest.fn(),
    setDownloadProgress: jest.fn(),
    addDownload: (download: unknown) => mockAddDownload(download),
  }),
}));
jest.mock('@/services/downloadService', () => ({
  downloadSurah: (...args: unknown[]) => mockDownloadSurah(...args),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({recitations: mockUploads})},
}));
jest.mock('@/utils/audioUtils', () => ({
  generateSmartAudioUrl: (
    reciter: {id: string},
    surahId: string,
    rewayatId?: string,
  ) => `https://audio.test/${reciter.id}/${rewayatId}/${surahId}.mp3`,
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => ''}));
jest.mock('@/utils/track', () => ({
  createUserUploadTrack: (upload: {id: string}) => ({
    id: `upload-${upload.id}`,
    userRecitationId: upload.id,
  }),
}));
jest.mock('@/utils/confirmDestructive', () => ({
  confirmDestructive: jest.fn(),
}));
jest.mock('@/components/TrackItem', () => ({TrackItem: () => null}));
jest.mock('@/components/Icons', () => ({
  HeartIcon: () => null,
  CheckIcon: () => null,
}));
jest.mock('@/components/playlist-detail/LovedHeader', () => ({
  LovedHeader: () => null,
}));
jest.mock('@/components/collection/CollectionStickyHeader', () => ({
  CollectionStickyHeader: () => null,
}));
jest.mock('@/components/sheets/options/surahOptions', () => ({
  SurahOptionsProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('@/components/sheets/options/collectionOptions', () => ({
  CollectionOptionsMenu: ({children}: {children?: React.ReactNode}) =>
    children ?? null,
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    show: (id: string, options: unknown) => mockShowSheet(id, options),
  },
}));

import LovedScreen from '@/app/(tabs)/(c.collection)/collection/loved';
import {TrackItem} from '@/components/TrackItem';
import {LovedHeader} from '@/components/playlist-detail/LovedHeader';

const loved = (surahId: string, over: Partial<Loved> = {}): Loved => ({
  reciterId: 'r1',
  surahId,
  rewayatId: 'rw1',
  timestamp: 1,
  ...over,
});

const rows = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => (node.type as unknown) === TrackItem);

const texts = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll(node => (node.type as unknown) === Text)
    .map(node => node.props.children);

const listOf = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.find(node => (node.type as unknown) === Animated.FlatList);

const queuedIds = () =>
  (mockUpdateQueue.mock.calls[0][0] as Array<{id: string}>).map(t => t.id);

let mounted: TestRenderer.ReactTestRenderer | null = null;

function render(): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<LovedScreen />);
  });
  mounted = tree;
  return tree;
}

// The first render loads React Native's list modules; on a cold transform
// cache that alone can pass Jest's 5 s default.
jest.setTimeout(30000);

beforeEach(() => {
  jest.clearAllMocks();
  mockUploads = [];
  mockDownloaded = new Set();
  mockDownloadSurah.mockImplementation(
    async (surahId: number, reciterId: string, rewayatId?: string) => ({
      filePath: `${surahId}_${reciterId}_${rewayatId}.mp3`,
      fileSize: 1,
    }),
  );
});

afterEach(() => {
  act(() => {
    mounted?.unmount();
  });
  mounted = null;
});

describe('tapping a surah', () => {
  it('queues Loved in its own order and starts at the tapped row', async () => {
    mockLovedTracks = [loved('1'), loved('2'), loved('3'), loved('4')];
    const tree = render();

    await act(async () => {
      await rows(tree)[2].props.onPress();
    });

    // Not rotated to 3, 4, 1, 2: Previous must reach surah 2.
    expect(queuedIds()).toEqual(['r1:1', 'r1:2', 'r1:3', 'r1:4']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(2);
    expect(mockStartNewChain).toHaveBeenCalledWith(
      expect.objectContaining({id: 'r1'}),
      expect.objectContaining({id: 3}),
      0,
      0,
      'rw1',
    );
  });

  it('starts at the right row when an earlier one cannot be played', async () => {
    // Row 2 is an upload that has been deleted.
    mockLovedTracks = [
      loved('1'),
      loved('2', {rewayatId: '', userRecitationId: 'gone'}),
      loved('3'),
    ];
    const tree = render();

    await act(async () => {
      await rows(tree)[2].props.onPress();
    });

    expect(queuedIds()).toEqual(['r1:1', 'r1:3']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(1);
  });

  it('does nothing for a row whose upload was deleted', async () => {
    mockLovedTracks = [
      loved('1', {rewayatId: '', userRecitationId: 'gone'}),
      loved('2'),
    ];
    const tree = render();

    await act(async () => {
      await rows(tree)[0].props.onPress();
    });

    // It used to play the next surah and record this one as recently played.
    expect(mockUpdateQueue).not.toHaveBeenCalled();
    expect(mockStartNewChain).not.toHaveBeenCalled();
  });

  it('plays an upload from its own file', async () => {
    mockUploads = [{id: 'u1'}];
    mockLovedTracks = [
      loved('1'),
      loved('2', {rewayatId: '', userRecitationId: 'u1'}),
    ];
    const tree = render();

    await act(async () => {
      await rows(tree)[1].props.onPress();
    });

    expect(queuedIds()).toEqual(['r1:1', 'upload-u1']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(1);
  });

  it('tells an upload from the catalogue row of the same reciter and surah', async () => {
    // Both saved without a rewayah: an old catalogue entry, and an upload.
    mockUploads = [{id: 'u1'}];
    mockLovedTracks = [
      loved('2', {rewayatId: ''}),
      loved('2', {rewayatId: '', userRecitationId: 'u1'}),
    ];
    const tree = render();
    expect(rows(tree)).toHaveLength(2);

    await act(async () => {
      await rows(tree)[1].props.onPress();
    });

    // It used to match the first row and start the catalogue recording.
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(1);
    expect(queuedIds()).toEqual(['r1:2', 'upload-u1']);
  });
});

it('unloving a surah keeps the list mounted', () => {
  mockLovedTracks = [loved('1'), loved('2'), loved('3')];
  const tree = render();
  expect(texts(tree)).not.toContain('Loading…');
  const list = listOf(tree);

  // The store drops one loved surah.
  mockLovedTracks = [loved('1'), loved('3')];
  act(() => {
    tree.update(<LovedScreen />);
  });

  expect(rows(tree).map(row => row.props.surahId)).toEqual(['1', '3']);
  expect(texts(tree)).not.toContain('Loading…');
  // A remount is what threw the scroll position back to the top.
  expect(listOf(tree)).toBe(list);
});

describe('"Download all"', () => {
  let alert: jest.SpyInstance;

  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alert.mockRestore();
  });

  /** Opens the screen's ••• menu and chooses "Download All". */
  async function downloadAll(tree: TestRenderer.ReactTestRenderer) {
    const header = tree.root.find(
      node => (node.type as unknown) === LovedHeader,
    );
    act(() => {
      header.props.onOptionsPress();
    });
    const payload = mockShowSheet.mock.calls[0][1].payload as {
      options: Array<{label: string; onPress: () => Promise<void>}>;
    };
    const option = payload.options.find(o => o.label === 'Download All');
    if (!option) throw new Error('no Download All option');
    await act(async () => {
      await option.onPress();
    });
  }

  const downloadedSurahs = () =>
    mockDownloadSurah.mock.calls.map(([surahId, reciterId, rewayatId]) => [
      surahId,
      reciterId,
      rewayatId,
    ]);

  it('saves a surah loved without a rewayah under the rewayah it plays in', async () => {
    mockLovedTracks = [loved('2', {rewayatId: ''})];
    const tree = render();
    // The row, its badge and its download all use the reciter's first one.
    expect(rows(tree)[0].props.rewayatId).toBe('r1-default');

    await downloadAll(tree);

    expect(downloadedSurahs()).toEqual([[2, 'r1', 'r1-default']]);
    expect(mockAddDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        reciterId: 'r1',
        surahId: '2',
        rewayatId: 'r1-default',
      }),
    );
    // Playing it looks the file up under the same rewayah.
    await act(async () => {
      await rows(tree)[0].props.onPress();
    });
    expect(mockUpdateQueue.mock.calls[0][0][0]).toMatchObject({
      rewayatId: 'r1-default',
      url: 'https://audio.test/r1/r1-default/2.mp3',
    });
  });

  it('does not download anything for an upload', async () => {
    mockUploads = [{id: 'u1'}];
    mockLovedTracks = [
      loved('1'),
      loved('2', {rewayatId: '', userRecitationId: 'u1'}),
    ];
    const tree = render();

    await downloadAll(tree);

    // It used to fetch the catalogue recording of surah 2.
    expect(downloadedSurahs()).toEqual([[1, 'r1', 'rw1']]);
    // The "All downloaded" state is worked out without uploads too.
    const counted = mockDownloadState.mock.calls.pop()?.[0] as Array<{
      track: {surahId: string};
    }>;
    expect(counted.map(item => item.track.surahId)).toEqual(['1']);
  });

  it('says so when every surah failed', async () => {
    mockDownloadSurah.mockRejectedValue(new Error('offline'));
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockLovedTracks = [loved('1'), loved('2')];
    const tree = render();

    await downloadAll(tree);
    error.mockRestore();

    // It used to say "Download Complete".
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith(
      'Download Error',
      'None of the surahs could be downloaded. Check your connection and try again.',
    );
    expect(mockAddDownload).not.toHaveBeenCalled();
  });

  it('counts what downloaded and what failed', async () => {
    mockDownloadSurah
      .mockResolvedValueOnce({filePath: 'a.mp3', fileSize: 1})
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({filePath: 'c.mp3', fileSize: 1});
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockLovedTracks = [loved('1'), loved('2'), loved('3')];
    const tree = render();

    await downloadAll(tree);
    error.mockRestore();

    expect(alert).toHaveBeenCalledWith(
      'Download Finished',
      'Downloaded: 2. Failed: 1. Choose Download All again to retry the rest.',
    );
  });

  it('says complete when everything downloaded', async () => {
    mockDownloaded = new Set(['r1:1:rw1']);
    mockLovedTracks = [loved('1'), loved('2')];
    const tree = render();

    await downloadAll(tree);

    // Surah 1 was already there and is not fetched again.
    expect(downloadedSurahs()).toEqual([[2, 'r1', 'rw1']]);
    expect(alert).toHaveBeenCalledWith(
      'Download Complete',
      'All loved surahs have been downloaded.',
    );
  });

  it('says already downloaded when there is nothing left to fetch', async () => {
    mockDownloaded = new Set(['r1:1:rw1', 'r1:2:r1-default']);
    mockLovedTracks = [loved('1'), loved('2', {rewayatId: ''})];
    const tree = render();

    await downloadAll(tree);

    expect(mockDownloadSurah).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'Already Downloaded',
      'All loved surahs are already downloaded.',
    );
  });
});
