// @ai-generated
/**
 * A reciter's downloads screen reloaded itself asynchronously behind a
 * "Loading…" view whenever any download changed. Removing one surah (or
 * another download finishing) blanked the screen and threw the list back to
 * the top. The rows are now derived straight from the download store.
 */
import React from 'react';
import {Animated, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {DownloadedSurah} from '@/services/player/store/downloadStore';

let mockDownloads: DownloadedSurah[] = [];
const mockGetReciterById = jest.fn();

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111', textSecondary: '#555', background: '#fff'}},
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({
  useLibraryListBottomPadding: () => 0,
}));
jest.mock('@/hooks/useCollectionNativeHeader', () => ({
  useCollectionNativeHeader: () => undefined,
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({
    addToQueue: jest.fn(),
    updateQueue: jest.fn(),
    toggleShuffle: jest.fn(),
  }),
}));
jest.mock('@/services/dataService', () => ({
  // The old per-row lookup; nothing may call it any more.
  getReciterById: (id: string) => mockGetReciterById(id),
  getReciterByIdSync: (id: string) => ({
    id,
    name: `Reciter ${id}`,
    image_url: null,
    rewayat: [{id: 'rw1', name: "Hafs A'n Assem", style: 'murattal'}],
  }),
  getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
}));
jest.mock('@/services/player/store/downloadSelectors', () => ({
  useDownloads: () => mockDownloads,
  useDownloadActions: () => ({removeDownload: jest.fn()}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: () => jest.fn(),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: () => false,
}));
jest.mock('@/services/rewayah/RewayahIdentity', () => ({
  getDisplayLabelFromName: (name: string) => name,
}));
jest.mock('@/utils/track', () => ({createDownloadedTrack: jest.fn()}));
jest.mock('@/utils/confirmDestructive', () => ({
  confirmDestructive: jest.fn(),
}));
jest.mock('@/i18n/format', () => ({
  getReciterDisplayName: (reciter: {name: string}) => reciter.name,
}));
jest.mock('@/components/SurahItem', () => ({SurahItem: () => null}));
jest.mock('@/components/playlist-detail/ReciterDownloadsHeader', () => ({
  ReciterDownloadsHeader: () => null,
}));
jest.mock('@/components/collection/CollectionStickyHeader', () => ({
  CollectionStickyHeader: () => null,
}));
jest.mock('@/components/sheets/options/OptionsMenu', () => ({
  useNativeOptionsMenu: () => false,
}));
jest.mock('@/components/sheets/options/collectionOptions', () => ({
  CollectionOptionsMenu: () => null,
}));
jest.mock('@/components/sheets/options/downloadOptions', () => ({
  DownloadOptionsMenu: () => null,
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

import {ReciterDownloadsList} from '../ReciterDownloadsList';
import {SurahItem} from '@/components/SurahItem';

const download = (surahId: string, reciterId = 'r1'): DownloadedSurah => ({
  reciterId,
  surahId,
  rewayatId: 'rw1',
  filePath: `/downloads/${reciterId}-${surahId}.mp3`,
  fileSize: 1,
  downloadDate: 1,
  status: 'completed',
});

const rows = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => (node.type as unknown) === SurahItem);

const texts = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll(node => (node.type as unknown) === Text)
    .map(node => node.props.children);

const listOf = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.find(node => (node.type as unknown) === Animated.FlatList);

let mounted: TestRenderer.ReactTestRenderer | null = null;

function render(): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ReciterDownloadsList reciterId="r1" />);
  });
  mounted = tree;
  return tree;
}

// The first render loads React Native's list modules; on a cold transform
// cache that alone can pass Jest's 5 s default.
jest.setTimeout(30000);

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => {
    mounted?.unmount();
  });
  mounted = null;
});

it("lists this reciter's downloads on the first render, in surah order", () => {
  mockDownloads = [download('36'), download('2'), download('5', 'r2')];
  const tree = render();

  expect(texts(tree)).not.toContain('Loading…');
  expect(rows(tree).map(row => row.props.item.id)).toEqual([2, 36]);
  expect(rows(tree)[0].props.rewayatName).toBe("Hafs A'n Assem • Murattal");
  expect(mockGetReciterById).not.toHaveBeenCalled();
});

it('removing a download keeps the list mounted', () => {
  mockDownloads = [download('2'), download('36'), download('67')];
  const tree = render();
  const list = listOf(tree);

  // The store drops one download.
  mockDownloads = [download('2'), download('67')];
  act(() => {
    tree.update(<ReciterDownloadsList reciterId="r1" />);
  });

  expect(rows(tree).map(row => row.props.item.id)).toEqual([2, 67]);
  expect(texts(tree)).not.toContain('Loading…');
  // A remount is what threw the scroll position back to the top.
  expect(listOf(tree)).toBe(list);
});
