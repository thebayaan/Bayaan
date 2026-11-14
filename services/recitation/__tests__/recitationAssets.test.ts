import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  createDownloadResumable: jest.fn(),
}));

const SECOND_LOOK_URL =
  'https://huggingface.co/Abdou/quran-asr-small/resolve/004f898639f3127a74eac1b898a2cb3ef0b5268d/model.int8.onnx';
const FOLLOWER_URL =
  'https://github.com/yazinsai/tilawa/releases/download/zipformer-a0w-ep1-a0.5/zipformer_a0w_ep1_a05.int8.onnx';
const SECOND_LOOK_BYTES = 36081762;
const FOLLOWER_BYTES = 69246033;
const CORPUS_BYTES = 5453439;
const DIR = 'file:///docs/recitation/';
const FOLLOWER = `${DIR}zipformer_a0w_ep1_a05.int8.onnx`;
const CORPUS = `${DIR}zipformer_quran.json`;
const SECOND_LOOK = `${DIR}quran-asr-small.int8.onnx`;

type Assets = typeof import('../recitationAssets');
let assets: Assets;

// What is on disk, by file.
let files: Map<string, number>;
const fs = FileSystem as unknown as {
  getInfoAsync: jest.Mock;
  createDownloadResumable: jest.Mock;
  deleteAsync: jest.Mock;
};
// URLs that fail to download.
let failing: Set<string>;
// URLs whose download never settles, as on an iOS background session that keeps
// waiting for a network.
let hanging: Set<string>;
// What each download was told to report its bytes to, by URL.
let reports: Map<string, (data: {totalBytesWritten: number}) => void>;
let downloads: string[];

function load(enabled = true): void {
  jest.isolateModules(() => {
    if (!enabled) {
      jest.doMock('../secondLook/config', () => ({
        ...jest.requireActual('../secondLook/config'),
        SECOND_LOOK_ENABLED: false,
      }));
    }
    assets = require('../recitationAssets');
    jest.dontMock('../secondLook/config');
  });
}

/** Lets a download that was started and not awaited run to its end. */
async function settled(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 1));
}

const SIZES: Record<string, number> = {
  [FOLLOWER]: FOLLOWER_BYTES,
  [CORPUS]: CORPUS_BYTES,
  [SECOND_LOOK]: SECOND_LOOK_BYTES,
};

beforeEach(() => {
  jest.clearAllMocks();
  files = new Map();
  failing = new Set();
  hanging = new Set();
  reports = new Map();
  downloads = [];
  fs.getInfoAsync.mockImplementation(async (uri: string) => {
    const size = files.get(uri);
    return size === undefined
      ? {exists: false, isDirectory: false}
      : {exists: true, isDirectory: false, size};
  });
  fs.createDownloadResumable.mockImplementation(
    (
      url: string,
      uri: string,
      _options: unknown,
      onProgress: (data: {totalBytesWritten: number}) => void,
    ) => ({
      downloadAsync: async () => {
        downloads.push(url);
        reports.set(url, onProgress);
        if (hanging.has(url)) await new Promise(() => undefined);
        if (failing.has(url)) return {status: 500};
        onProgress({totalBytesWritten: SIZES[uri]});
        files.set(uri, SIZES[uri]);
        return {status: 200};
      },
    }),
  );
  load();
});

describe('the size the UI states', () => {
  function statedSize(enabled: boolean): number {
    let size = 0;
    jest.isolateModules(() => {
      if (!enabled) {
        jest.doMock('../secondLook/config', () => ({
          ...jest.requireActual('../secondLook/config'),
          SECOND_LOOK_ENABLED: false,
        }));
      }
      size = require('@/constants/recitation').RECITATION_DOWNLOAD_MB;
      jest.dontMock('../secondLook/config');
    });
    return size;
  }

  it('covers what is downloaded', () => {
    expect(statedSize(true)).toBe(
      Math.round((FOLLOWER_BYTES + CORPUS_BYTES + SECOND_LOOK_BYTES) / 1e6),
    );
  });

  it('turned off, it leaves the second look out', () => {
    expect(statedSize(false)).toBe(
      Math.round((FOLLOWER_BYTES + CORPUS_BYTES) / 1e6),
    );
  });
});

describe('recitationAssets and the second look model', () => {
  it('downloads it with the others, from the pinned revision', async () => {
    await assets.ensureRecitationAssets(() => undefined);
    await settled();
    expect(downloads).toHaveLength(3);
    expect(downloads).toContain(SECOND_LOOK_URL);
    await expect(assets.secondLookModelPath()).resolves.toBe(SECOND_LOOK);
  });

  it('starts it beside the follower model, so a working network has it for the first take', async () => {
    hanging.add(FOLLOWER_URL);
    void assets.ensureRecitationAssets(() => undefined);
    await settled();
    expect(downloads).toContain(SECOND_LOOK_URL);
    await expect(assets.secondLookModelPath()).resolves.toBe(SECOND_LOOK);
  });

  it('progress covers the files the follower waits for, up to 1', async () => {
    const seen: number[] = [];
    await assets.ensureRecitationAssets(p => seen.push(p));
    const total = FOLLOWER_BYTES + CORPUS_BYTES;
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBeCloseTo(CORPUS_BYTES / total);
    expect(seen[1]).toBeCloseTo(1);
  });

  it('a download of it that never ends does not hold the follower back', async () => {
    hanging.add(SECOND_LOOK_URL);
    const seen: number[] = [];
    await expect(
      assets.ensureRecitationAssets(p => seen.push(p)),
    ).resolves.toEqual({modelPath: FOLLOWER, corpusPath: CORPUS});
    expect(seen[seen.length - 1]).toBeCloseTo(1);
    await expect(assets.getRecitationAssets()).resolves.toEqual({
      modelPath: FOLLOWER,
      corpusPath: CORPUS,
    });
    await expect(assets.secondLookModelPath()).resolves.toBeNull();
  });

  it('its bytes never move the bar: nothing is left to wait for', async () => {
    hanging.add(SECOND_LOOK_URL);
    const seen: number[] = [];
    await assets.ensureRecitationAssets(p => seen.push(p));
    const before = seen.length;
    reports.get(SECOND_LOOK_URL)?.({totalBytesWritten: 1000});
    expect(seen).toHaveLength(before);
  });

  it('a take that asks for it while it runs joins the same download', async () => {
    hanging.add(SECOND_LOOK_URL);
    await assets.ensureRecitationAssets(() => undefined);
    void assets.ensureSecondLookModel();
    await settled();
    expect(downloads.filter(url => url === SECOND_LOOK_URL)).toHaveLength(1);
  });

  it('a failed download of it does not stop the follower', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    failing.add(SECOND_LOOK_URL);
    await expect(
      assets.ensureRecitationAssets(() => undefined),
    ).resolves.toEqual({modelPath: FOLLOWER, corpusPath: CORPUS});
    await settled();
    expect(warn).toHaveBeenCalledTimes(1);
    await expect(assets.secondLookModelPath()).resolves.toBeNull();
    warn.mockRestore();
  });

  it('a failed download of it can be tried again', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    failing.add(SECOND_LOOK_URL);
    await assets.ensureRecitationAssets(() => undefined);
    await settled();
    failing.clear();
    await assets.ensureSecondLookModel();
    await expect(assets.secondLookModelPath()).resolves.toBe(SECOND_LOOK);
    warn.mockRestore();
  });

  it('a failed download of the follower still fails', async () => {
    failing.add(FOLLOWER_URL);
    await expect(
      assets.ensureRecitationAssets(() => undefined),
    ).rejects.toThrow('Download failed');
  });

  it('the follower does not need it: an install from before it is still ready', async () => {
    files.set(FOLLOWER, FOLLOWER_BYTES);
    files.set(CORPUS, CORPUS_BYTES);
    await expect(assets.getRecitationAssets()).resolves.toEqual({
      modelPath: FOLLOWER,
      corpusPath: CORPUS,
    });
    await expect(assets.secondLookModelPath()).resolves.toBeNull();
  });

  it('a file of the wrong size is not it', async () => {
    files.set(SECOND_LOOK, SECOND_LOOK_BYTES - 1);
    await expect(assets.secondLookModelPath()).resolves.toBeNull();
  });

  it('a truncated download is thrown away', async () => {
    fs.createDownloadResumable.mockImplementationOnce(
      (_url: string, uri: string) => ({
        downloadAsync: async () => {
          files.set(uri, 100);
          return {status: 200};
        },
      }),
    );
    await expect(assets.ensureSecondLookModel()).rejects.toThrow(
      'Download failed',
    );
    expect(fs.deleteAsync).toHaveBeenCalledWith(SECOND_LOOK, {
      idempotent: true,
    });
  });

  it('it can be fetched alone, for an install from before it', async () => {
    await assets.ensureSecondLookModel();
    expect(downloads).toEqual([SECOND_LOOK_URL]);
    await expect(assets.secondLookModelPath()).resolves.toBe(SECOND_LOOK);
  });

  it('asked twice at once, it downloads once', async () => {
    await Promise.all([
      assets.ensureSecondLookModel(),
      assets.ensureSecondLookModel(),
    ]);
    expect(downloads).toEqual([SECOND_LOOK_URL]);
  });

  it('a file already there is not downloaded again', async () => {
    files.set(SECOND_LOOK, SECOND_LOOK_BYTES);
    await assets.ensureSecondLookModel();
    expect(downloads).toEqual([]);
  });

  it('removing the assets removes it with the folder', async () => {
    await assets.deleteRecitationAssets();
    expect(fs.deleteAsync).toHaveBeenCalledWith(DIR, {idempotent: true});
  });

  it('turned off, it is never downloaded and progress leaves it out', async () => {
    load(false);
    const seen: number[] = [];
    await assets.ensureRecitationAssets(p => seen.push(p));
    await settled();
    expect(downloads).toHaveLength(2);
    expect(downloads).not.toContain(SECOND_LOOK_URL);
    expect(seen[seen.length - 1]).toBeCloseTo(1);
  });
});
