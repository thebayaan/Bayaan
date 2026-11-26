// @ai-generated
/**
 * "Download Playlist": the result alert says what really happened, the
 * user's own uploads are left out, and a recitation that is in the playlist
 * twice is fetched once. Runs on the real download store.
 */
import React from 'react';
import {Alert} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

interface Item {
  id: string;
  playlistId: string;
  surahId: string;
  reciterId: string;
  rewayatId?: string;
  orderIndex: number;
  addedAt: number;
  userRecitationId?: string;
}

const mockGetPlaylistItems = jest.fn<Promise<Item[]>, [string]>();
const mockDownloadSurah = jest.fn();

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn(), hide: jest.fn()},
}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
      <MockView>{children}</MockView>
    ),
  };
});
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
      },
    },
  }),
}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));
jest.mock('@/components/Icons', () => ({CheckIcon: () => null}));
jest.mock('@/store/playlistsStore', () => ({
  usePlaylistsStore: () => ({getPlaylistItems: mockGetPlaylistItems}),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackDownloadCompleted: jest.fn(),
    trackDownloadStarted: jest.fn(),
  },
}));
jest.mock('@/services/downloadService', () => ({
  downloadSurah: (...args: unknown[]) => mockDownloadSurah(...args),
  downloadFailureReason: (error: {reason?: string} | undefined) =>
    error?.reason ?? 'failed',
  clearAllDownloads: jest.fn(async () => undefined),
  removeDownload: jest.fn(async () => undefined),
  extractFilename: (path: string) => path,
}));

import {PlaylistContextSheet} from '../PlaylistContextSheet';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {useNetworkStore} from '@/store/networkStore';

function item(
  surahId: string,
  extra: Partial<Item> = {},
  rewayatId = 'hafs',
): Item {
  return {
    id: `${surahId}-${Math.random()}`,
    playlistId: 'p1',
    surahId,
    reciterId: 'reciter',
    rewayatId,
    orderIndex: 0,
    addedAt: 0,
    ...extra,
  };
}

let alertSpy: jest.SpyInstance;

/** Opens the sheet the way a tablet's "Download" menu row does, and waits. */
async function downloadPlaylist(items: Item[]) {
  mockGetPlaylistItems.mockResolvedValue(items);
  await act(async () => {
    TestRenderer.create(
      <PlaylistContextSheet
        sheetId="playlist-context"
        payload={{
          playlistId: 'p1',
          playlistName: 'Mine',
          onDelete: () => undefined,
          startDownload: true,
        }}
      />,
    );
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });
}

function lastAlert(): [string, string] {
  const calls = alertSpy.mock.calls;
  const [title, message] = calls[calls.length - 1];
  return [title, message];
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockGetPlaylistItems.mockReset();
  mockDownloadSurah.mockReset();
  mockDownloadSurah.mockImplementation(async (surahId: number) => ({
    filePath: `${surahId}.mp3`,
    fileSize: 10,
  }));
  useNetworkStore.setState({isOnline: true});
  useDownloadStore.setState({
    downloads: [],
    downloading: [],
    downloadProgress: {},
    playlistDownloads: {},
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('reports success with the number actually downloaded', async () => {
  await downloadPlaylist([item('1'), item('2')]);
  expect(alertSpy).toHaveBeenCalledTimes(1);
  expect(lastAlert()).toEqual([
    'Download Complete',
    'Successfully downloaded 2 items from "Mine".',
  ]);
  expect(useDownloadStore.getState().downloads).toHaveLength(2);
});

it('says so when every item failed', async () => {
  mockDownloadSurah.mockRejectedValue(new Error('HTTP 503'));
  await downloadPlaylist([item('1'), item('2')]);
  expect(lastAlert()).toEqual([
    'Download Failed',
    'An error occurred while downloading the playlist. Please try again.',
  ]);
  expect(useDownloadStore.getState().downloads).toHaveLength(0);
});

it('says the device is offline when that is why every item failed', async () => {
  mockDownloadSurah.mockRejectedValue(
    Object.assign(new Error('offline'), {reason: 'offline'}),
  );
  await downloadPlaylist([item('1'), item('2')]);
  expect(lastAlert()).toEqual([
    'Download Failed',
    "You're offline. Connect to the internet and try again.",
  ]);
});

it('reports a partly failed batch as incomplete, with the counts', async () => {
  mockDownloadSurah.mockImplementation(async (surahId: number) => {
    if (surahId === 2) throw new Error('HTTP 503');
    return {filePath: `${surahId}.mp3`, fileSize: 10};
  });
  await downloadPlaylist([item('1'), item('2'), item('3')]);
  expect(lastAlert()).toEqual([
    'Download Incomplete',
    'Downloaded 2 of 3 from "Mine". Try again to download the rest.',
  ]);
});

it("does not download the catalogue file for the user's own uploads", async () => {
  await downloadPlaylist([
    item('1'),
    item('2', {userRecitationId: 'upload-1'}),
  ]);
  expect(mockDownloadSurah).toHaveBeenCalledTimes(1);
  expect(mockDownloadSurah.mock.calls[0][0]).toBe(1);
  expect(lastAlert()[1]).toBe('Successfully downloaded 1 item from "Mine".');
});

it('fetches a recitation that is in the playlist twice only once', async () => {
  await downloadPlaylist([item('1'), item('1')]);
  expect(mockDownloadSurah).toHaveBeenCalledTimes(1);
  expect(lastAlert()[1]).toBe('Successfully downloaded 1 item from "Mine".');
});
