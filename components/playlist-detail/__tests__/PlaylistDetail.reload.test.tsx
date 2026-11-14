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
let mockPlaylists: UserPlaylist[] = [];

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
    updateQueue: jest.fn(),
    addToQueue: jest.fn(),
    play: jest.fn(),
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
  createTrack: jest.fn(),
  createUserUploadTrack: jest.fn(),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({recitations: []})},
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
jest.mock('../PlaylistHeader', () => ({PlaylistHeader: () => null}));
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

const item = (id: string, surahId: string): PlaylistItem => ({
  id,
  playlistId: 'p1',
  surahId,
  reciterId: 'r1',
  rewayatId: 'rw1',
  orderIndex: 0,
  addedAt: 1,
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
