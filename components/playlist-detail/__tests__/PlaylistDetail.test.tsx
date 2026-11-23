// @ai-generated
/**
 * The playlist screen loaded its tracks once, on mount. A surah added to the
 * open playlist from another tab left it saying "empty", and a playlist
 * deleted elsewhere left it on "Loading…" forever. It now reloads when the
 * shared store's copy of the playlist changes, keeps the list on screen while
 * it does, and says so when the playlist is gone.
 */
import React from 'react';
import {Animated, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {
  PlaylistItem,
  UserPlaylist,
} from '@/services/database/DatabaseService';

const mockBack = jest.fn();
const mockGetPlaylist = jest.fn<Promise<UserPlaylist | null>, [string]>();
const mockGetPlaylistItems = jest.fn<Promise<PlaylistItem[]>, [string]>();
const mockRemoveFromPlaylist = jest.fn<Promise<void>, [string]>();
const mockUpdateQueue = jest.fn();
const mockPlay = jest.fn();
let mockPlaylists: UserPlaylist[] = [];
let mockUploads: Array<{id: string}> = [];

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
jest.mock('@/hooks/usePlaylists', () => ({
  usePlaylists: () => ({
    playlists: mockPlaylists,
    getPlaylist: mockGetPlaylist,
    getPlaylistItems: mockGetPlaylistItems,
    removeFromPlaylist: mockRemoveFromPlaylist,
    updatePlaylist: jest.fn(),
    deletePlaylist: jest.fn(),
  }),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({
    updateQueue: mockUpdateQueue,
    addToQueue: jest.fn(),
    play: mockPlay,
  }),
}));
jest.mock('@/services/dataService', () => {
  const reciter = (id: string) => ({id, name: `Reciter ${id}`, rewayat: []});
  return {
    getReciterById: async (id: string) => reciter(id),
    getReciterByIdSync: (id: string) => reciter(id),
    getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
  };
});
jest.mock('@/utils/track', () => ({
  createTrack: async (reciter: {id: string}, surah: {id: number}) => ({
    id: `${reciter.id}-${surah.id}`,
  }),
  createUserUploadTrack: (upload: {id: string}) => ({
    id: `upload-${upload.id}`,
  }),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({recitations: mockUploads})},
}));
jest.mock('@/components/TrackItem', () => ({TrackItem: () => null}));
jest.mock('@/components/sheets/options/surahOptions', () => ({
  SurahOptionsRow: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('@/components/sheets/options/OptionsMenu', () => ({
  useNativeOptionsMenu: () => false,
}));
jest.mock('@/components/sheets/options/playlistOptions', () => ({
  PlaylistOptionsMenu: () => null,
}));
jest.mock('@/components/collection/CollectionStickyHeader', () => ({
  CollectionStickyHeader: () => null,
}));
jest.mock('@/components/collection/CollectionScreenHeader', () => ({
  CollectionScreenHeader: () => null,
}));
jest.mock('@/components/collection/CollectionArt', () => ({
  SurahCover: () => null,
}));
jest.mock('@/components/collection/CollectionPanel', () => ({
  PANEL_ART_SIZE: 48,
  PANEL_ART_RADIUS: 8,
  PanelRow: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('@/components/Icons', () => ({
  PlayIcon: () => null,
  ShuffleIcon: () => null,
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));
jest.mock('expo-router', () => ({useRouter: () => ({back: mockBack})}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {Medium: 'medium'},
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

import PlaylistDetail from '../PlaylistDetail';
import {TrackItem} from '@/components/TrackItem';
import {SurahOptionsRow} from '@/components/sheets/options/surahOptions';

const playlist = (over: Partial<UserPlaylist> = {}): UserPlaylist => ({
  id: 'p1',
  name: 'Morning',
  color: '#6366F1',
  createdAt: 1,
  updatedAt: 1,
  itemCount: 0,
  ...over,
});

const item = (
  id: string,
  surahId: string,
  userRecitationId?: string,
): PlaylistItem => ({
  id,
  playlistId: 'p1',
  surahId,
  reciterId: 'r1',
  rewayatId: 'rw1',
  orderIndex: 0,
  addedAt: 1,
  userRecitationId,
});

const flush = async () => {
  await act(async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
  });
};

const texts = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll(node => (node.type as unknown) === Text)
    .map(node => node.props.children);

const listOf = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.find(node => (node.type as unknown) === Animated.FlatList);

const rows = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => (node.type as unknown) === TrackItem);

let mounted: TestRenderer.ReactTestRenderer | null = null;

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<PlaylistDetail id="p1" />);
  });
  mounted = tree;
  await flush();
  return tree;
}

// The first render loads React Native's list modules; on a cold transform
// cache that alone can pass Jest's 5 s default.
jest.setTimeout(30000);

afterEach(() => {
  // Unmount so the list's batching timer does not fire after the test.
  act(() => {
    mounted?.unmount();
  });
  mounted = null;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUploads = [];
  mockPlaylists = [playlist()];
  mockGetPlaylist.mockResolvedValue(playlist());
  mockGetPlaylistItems.mockResolvedValue([]);
  mockRemoveFromPlaylist.mockResolvedValue(undefined);
});

it('shows a surah added to the open playlist from elsewhere', async () => {
  const tree = await render();
  expect(texts(tree)).toContain('No surahs in this playlist');
  expect(rows(tree)).toHaveLength(0);

  // Another tab adds a surah: the store's copy gets a new count and time.
  mockPlaylists = [playlist({itemCount: 1, updatedAt: 2})];
  mockGetPlaylist.mockResolvedValue(playlist({itemCount: 1, updatedAt: 2}));
  mockGetPlaylistItems.mockResolvedValue([item('i1', '2')]);
  act(() => {
    tree.update(<PlaylistDetail id="p1" />);
  });
  await flush();

  expect(rows(tree)).toHaveLength(1);
  expect(texts(tree)).not.toContain('No surahs in this playlist');
});

it('keeps the list on screen while it reloads', async () => {
  mockGetPlaylistItems.mockResolvedValue([item('i1', '2')]);
  mockPlaylists = [playlist({itemCount: 1})];
  const tree = await render();
  const list = listOf(tree);

  let finishReload: (items: PlaylistItem[]) => void = () => undefined;
  mockGetPlaylistItems.mockReturnValue(
    new Promise<PlaylistItem[]>(resolve => {
      finishReload = resolve;
    }),
  );
  mockPlaylists = [playlist({itemCount: 2, updatedAt: 2})];
  act(() => {
    tree.update(<PlaylistDetail id="p1" />);
  });
  await flush();

  // Mid-reload: no "Loading…" view, and the same list instance is mounted
  // (a remount is what threw the scroll position back to the top).
  expect(texts(tree)).not.toContain('Loading…');
  expect(listOf(tree)).toBe(list);

  finishReload([item('i2', '3'), item('i1', '2')]);
  await flush();
  expect(rows(tree)).toHaveLength(2);
  expect(listOf(tree)).toBe(list);
});

it('ignores an older load that finishes after a newer one', async () => {
  let finishFirst: (items: PlaylistItem[]) => void = () => undefined;
  mockGetPlaylistItems.mockReturnValueOnce(
    new Promise<PlaylistItem[]>(resolve => {
      finishFirst = resolve;
    }),
  );
  const tree = await render();

  mockPlaylists = [playlist({itemCount: 2, updatedAt: 2})];
  mockGetPlaylistItems.mockResolvedValue([item('i2', '3'), item('i1', '2')]);
  act(() => {
    tree.update(<PlaylistDetail id="p1" />);
  });
  await flush();
  expect(rows(tree)).toHaveLength(2);

  finishFirst([]);
  await flush();
  expect(rows(tree)).toHaveLength(2);
});

it('says the playlist is gone and offers a way back', async () => {
  mockPlaylists = [];
  mockGetPlaylist.mockResolvedValue(null);
  const tree = await render();

  expect(texts(tree)).toContain('This playlist no longer exists');
  expect(texts(tree)).not.toContain('Loading…');
  const back = tree.root.find(
    node =>
      node.props.accessibilityRole === 'button' &&
      typeof node.props.onPress === 'function',
  );
  act(() => {
    back.props.onPress();
  });
  expect(mockBack).toHaveBeenCalledTimes(1);
});

it('switches to the gone state when the open playlist is deleted elsewhere', async () => {
  mockGetPlaylistItems.mockResolvedValue([item('i1', '2')]);
  mockPlaylists = [playlist({itemCount: 1})];
  const tree = await render();
  expect(rows(tree)).toHaveLength(1);

  mockPlaylists = [];
  mockGetPlaylist.mockResolvedValue(null);
  mockGetPlaylistItems.mockResolvedValue([]);
  act(() => {
    tree.update(<PlaylistDetail id="p1" />);
  });
  await flush();

  expect(texts(tree)).toContain('This playlist no longer exists');
  expect(rows(tree)).toHaveLength(0);
});

it('removing a surah drops its row in place', async () => {
  mockGetPlaylistItems.mockResolvedValue([item('i2', '3'), item('i1', '2')]);
  mockPlaylists = [playlist({itemCount: 2})];
  const tree = await render();
  const list = listOf(tree);
  expect(rows(tree).map(row => row.props.surahId)).toEqual(['3', '2']);

  const options = tree.root.findAll(
    node => (node.type as unknown) === SurahOptionsRow,
  )[0].props.payload;
  await act(async () => {
    await options.onRemoveFromPlaylist();
  });

  expect(mockRemoveFromPlaylist).toHaveBeenCalledWith('i2');
  expect(rows(tree).map(row => row.props.surahId)).toEqual(['2']);
  expect(texts(tree)).not.toContain('Loading…');
  expect(listOf(tree)).toBe(list);
});

describe('tapping a surah', () => {
  const queued = () =>
    (mockUpdateQueue.mock.calls[0][0] as Array<{id: string}>).map(t => t.id);

  it('queues the playlist in its own order and starts at the tapped row', async () => {
    mockGetPlaylistItems.mockResolvedValue([
      item('i1', '1'),
      item('i2', '2'),
      item('i3', '3'),
      item('i4', '4'),
    ]);
    mockPlaylists = [playlist({itemCount: 4})];
    const tree = await render();

    await act(async () => {
      await rows(tree)[2].props.onPress();
    });

    // Not rotated to 3, 4, 1, 2: Previous must reach surah 2.
    expect(queued()).toEqual(['r1-1', 'r1-2', 'r1-3', 'r1-4']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(2);
  });

  it('starts at the right row when an earlier one cannot be played', async () => {
    // Row 2 is an upload that has been deleted.
    mockGetPlaylistItems.mockResolvedValue([
      item('i1', '1'),
      item('i2', '2', 'gone'),
      item('i3', '3'),
    ]);
    mockPlaylists = [playlist({itemCount: 3})];
    const tree = await render();

    await act(async () => {
      await rows(tree)[2].props.onPress();
    });

    expect(queued()).toEqual(['r1-1', 'r1-3']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(1);
  });

  it('plays the tapped row when two rows are the same reciter and surah', async () => {
    mockUploads = [{id: 'u1'}];
    mockGetPlaylistItems.mockResolvedValue([
      item('i1', '2'),
      item('i2', '2', 'u1'),
    ]);
    mockPlaylists = [playlist({itemCount: 2})];
    const tree = await render();

    await act(async () => {
      await rows(tree)[1].props.onPress();
    });

    expect(queued()).toEqual(['r1-2', 'upload-u1']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(1);
  });

  it('does nothing for a row whose upload was deleted', async () => {
    mockGetPlaylistItems.mockResolvedValue([
      item('i1', '1', 'gone'),
      item('i2', '2'),
    ]);
    mockPlaylists = [playlist({itemCount: 2})];
    const tree = await render();

    await act(async () => {
      await rows(tree)[0].props.onPress();
    });

    // It used to fall through to another row.
    expect(mockUpdateQueue).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });
});
