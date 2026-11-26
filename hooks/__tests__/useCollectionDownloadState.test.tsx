// @ai-generated
/**
 * The "Download all" / "All downloaded" label of Loved and of a playlist, on
 * the real download store: it has to follow downloads being added and
 * removed while the screen is open.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackDownloadCompleted: jest.fn(),
    trackDownloadStarted: jest.fn(),
  },
}));
jest.mock('@/services/downloadService', () => ({
  clearAllDownloads: jest.fn(async () => undefined),
  removeDownload: jest.fn(async () => undefined),
  extractFilename: (path: string) => path,
}));

import {RECITERS, type Reciter} from '@/data/reciterData';
import {
  useDownloadStore,
  type DownloadedSurah,
} from '@/services/player/store/downloadStore';
import {useCollectionDownloadState} from '../useCollectionDownloadState';

type Items = Parameters<typeof useCollectionDownloadState>[0];
type State = ReturnType<typeof useCollectionDownloadState>;

function item(surahId: string, rewayatId?: string, userRecitationId?: string) {
  return {
    reciter: {id: 'reciter'},
    surah: {id: Number(surahId)},
    track: {reciterId: 'reciter', surahId, rewayatId, userRecitationId},
  };
}

function download(surahId: string, rewayatId = ''): DownloadedSurah {
  return {
    reciterId: 'reciter',
    surahId,
    rewayatId,
    filePath: `${surahId}.mp3`,
    fileSize: 10,
    downloadDate: 0,
    status: 'completed',
  };
}

let latest: State;
function Probe({items}: {items: Items}) {
  latest = useCollectionDownloadState(items);
  return null;
}

function render(items: Items) {
  act(() => {
    TestRenderer.create(<Probe items={items} />);
  });
}

beforeEach(() => {
  act(() => {
    useDownloadStore.setState({downloads: []});
  });
});

afterEach(() => {
  RECITERS.splice(0, RECITERS.length);
});

it('follows downloads added and removed after the first render', async () => {
  const items = [item('1', 'hafs'), item('2', 'hafs')];
  render(items);
  expect(latest).toMatchObject({allDownloaded: false, downloadedCount: 0});

  act(() => {
    useDownloadStore.getState().addDownload(download('1', 'hafs'));
    useDownloadStore.getState().addDownload(download('2', 'hafs'));
  });
  expect(latest).toMatchObject({allDownloaded: true, downloadedCount: 2});

  await act(async () => {
    await useDownloadStore.getState().removeDownload('reciter', '2', 'hafs');
  });
  expect(latest).toMatchObject({allDownloaded: false, downloadedCount: 1});
});

it('keeps downloads of one rewayah apart from another', () => {
  render([item('1', 'warsh'), item('2')]);
  act(() => {
    // Surah 1 in another rewayah, surah 2 under a rewayah the item lacks.
    useDownloadStore.getState().addDownload(download('1', 'hafs'));
    useDownloadStore.getState().addDownload(download('2', 'hafs'));
  });
  expect(latest.downloadedCount).toBe(0);

  act(() => {
    useDownloadStore.getState().addDownload(download('1', 'warsh'));
    useDownloadStore.getState().addDownload(download('2'));
  });
  expect(latest).toMatchObject({allDownloaded: true, downloadedCount: 2});
});

it("counts a download without a rewayah for the reciter's first rewayah", () => {
  // Catalogue order: such a download fetched Warsh, and plays only for it.
  RECITERS.splice(0, RECITERS.length, {
    id: 'reciter',
    rewayat: [{id: 'warsh'}, {id: 'hafs'}],
  } as unknown as Reciter);
  render([item('1', 'warsh'), item('2', 'hafs')]);

  act(() => {
    useDownloadStore.getState().addDownload(download('1'));
    useDownloadStore.getState().addDownload(download('2'));
  });
  expect(latest).toMatchObject({allDownloaded: false, downloadedCount: 1});
});

it("leaves the user's own uploads out of the count", () => {
  render([item('1', 'hafs'), item('2', undefined, 'upload-1')]);
  expect(latest).toMatchObject({totalTracks: 1, allDownloaded: false});

  act(() => {
    useDownloadStore.getState().addDownload(download('1', 'hafs'));
  });
  expect(latest).toMatchObject({totalTracks: 1, allDownloaded: true});
});

it('has nothing to download when every item is an upload', () => {
  render([item('1', undefined, 'upload-1')]);
  expect(latest).toMatchObject({hasNoTracks: true, allDownloaded: false});
});
