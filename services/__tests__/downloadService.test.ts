// @ai-generated
/**
 * downloadSurah on a stubbed file system: a surah only counts as downloaded
 * once the whole file has arrived. An interrupted download, an HTTP error
 * page or a short file must never end up under the real .mp3 name.
 */
import {Platform} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {useNetworkStore} from '@/store/networkStore';
import {downloadFailureReason, downloadSurah} from '../downloadService';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
}));
jest.mock('../dataService', () => ({
  fetchAudioUrl: jest.fn(async () => 'https://cdn.test/hafs/001.mp3'),
}));

const FINAL = 'file:///docs/001_reciter_rewayah.mp3';
const PART = `${FINAL}.part`;

interface TransferResult {
  status: number;
  headers: Record<string, string>;
}

const fs = FileSystem as unknown as {
  getInfoAsync: jest.Mock;
  deleteAsync: jest.Mock;
  moveAsync: jest.Mock;
  createDownloadResumable: jest.Mock;
};

/** The fake disk: uri to size in bytes. */
let files: Map<string, number>;
/** What the next transfer does: writes to the fake disk and answers. */
let transfer: (uri: string) => Promise<TransferResult | undefined>;

/** The native cancel call of the transfer in flight. */
const cancelAsync = jest.fn(async () => undefined);

function download() {
  return downloadSurah(1, 'reciter', 'rewayah');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  useNetworkStore.setState({isOnline: true, isConnected: true});
  files = new Map();
  transfer = async uri => {
    files.set(uri, 5000);
    return {status: 200, headers: {'Content-Length': '5000'}};
  };
  fs.getInfoAsync.mockImplementation(async (uri: string) => {
    const size = files.get(uri);
    return size === undefined
      ? {exists: false, isDirectory: false}
      : {exists: true, isDirectory: false, size};
  });
  fs.deleteAsync.mockImplementation(async (uri: string) => {
    files.delete(uri);
  });
  fs.moveAsync.mockImplementation(
    async ({from, to}: {from: string; to: string}) => {
      const size = files.get(from);
      if (size === undefined) throw new Error(`nothing at ${from}`);
      files.delete(from);
      files.set(to, size);
    },
  );
  fs.createDownloadResumable.mockImplementation(
    (_url: string, uri: string) => ({
      downloadAsync: () => transfer(uri),
      cancelAsync,
    }),
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('saves a complete download under the real name', async () => {
  await expect(download()).resolves.toEqual({
    filePath: '001_reciter_rewayah.mp3',
    fileSize: 5000,
  });
  expect(files.get(FINAL)).toBe(5000);
  expect(files.has(PART)).toBe(false);
});

it('reads the size from the file when the header name is lowercase', async () => {
  // Android over HTTP/2: the old "Content-Length" lookup missed and stored 0.
  transfer = async uri => {
    files.set(uri, 5000);
    return {status: 200, headers: {'content-length': '5000'}};
  };
  await expect(download()).resolves.toMatchObject({fileSize: 5000});
});

it('does not trust a file an interrupted download left at the real name', async () => {
  files.set(FINAL, 1200);
  await expect(download()).resolves.toMatchObject({fileSize: 5000});
  expect(fs.createDownloadResumable).toHaveBeenCalledTimes(1);
  expect(files.get(FINAL)).toBe(5000);
});

it('clears a partial file left by a killed app before starting', async () => {
  files.set(PART, 700);
  let partAtStart: number | undefined;
  transfer = async uri => {
    partAtStart = files.get(uri);
    files.set(uri, 5000);
    return {status: 200, headers: {'Content-Length': '5000'}};
  };
  await download();
  expect(partAtStart).toBeUndefined();
});

it('rejects an HTTP error page instead of saving it as the mp3', async () => {
  transfer = async uri => {
    files.set(uri, 300);
    return {status: 404, headers: {'Content-Length': '300'}};
  };
  await expect(download()).rejects.toThrow('HTTP 404');
  expect(files.size).toBe(0);
});

it('rejects a file shorter than the server said it would send', async () => {
  transfer = async uri => {
    files.set(uri, 1200);
    return {status: 200, headers: {'content-length': '5000'}};
  };
  await expect(download()).rejects.toThrow('1200 of 5000');
  expect(files.size).toBe(0);
});

it('rejects an empty file', async () => {
  transfer = async uri => {
    files.set(uri, 0);
    return {status: 200, headers: {}};
  };
  await expect(download()).rejects.toThrow();
  expect(files.size).toBe(0);
});

it('skips the size check when the body was compressed in transit', async () => {
  transfer = async uri => {
    files.set(uri, 5000);
    return {
      status: 200,
      headers: {'Content-Encoding': 'gzip', 'Content-Length': '3000'},
    };
  };
  await expect(download()).resolves.toMatchObject({fileSize: 5000});
});

it('fails when the transfer returns nothing, and removes the partial file', async () => {
  // What a cancelled transfer resolves with.
  transfer = async uri => {
    files.set(uri, 900);
    return undefined;
  };
  await expect(download()).rejects.toThrow();
  expect(files.size).toBe(0);
});

it('keeps the copy already on disk when the new download fails', async () => {
  files.set(FINAL, 5000);
  transfer = async uri => {
    files.set(uri, 900);
    throw new Error('connection lost');
  };
  await expect(download()).rejects.toThrow('connection lost');
  expect(files.get(FINAL)).toBe(5000);
  expect(files.has(PART)).toBe(false);
});

it('shares one transfer between two calls for the same file', async () => {
  let finish: (() => void) | undefined;
  transfer = uri =>
    new Promise(resolve => {
      finish = () => {
        files.set(uri, 5000);
        resolve({status: 200, headers: {'Content-Length': '5000'}});
      };
    });
  const first = download();
  const second = download();
  // Let both calls reach the transfer.
  await new Promise(resolve => setImmediate(resolve));
  expect(fs.createDownloadResumable).toHaveBeenCalledTimes(1);
  finish?.();
  await expect(first).resolves.toMatchObject({fileSize: 5000});
  await expect(second).resolves.toMatchObject({fileSize: 5000});
  expect(files.get(FINAL)).toBe(5000);

  // The finished transfer is forgotten: a later call downloads again.
  transfer = async uri => {
    files.set(uri, 5000);
    return {status: 200, headers: {'Content-Length': '5000'}};
  };
  await download();
  expect(fs.createDownloadResumable).toHaveBeenCalledTimes(2);
});

describe('offline', () => {
  it('does not start a download on iOS, where it would wait for good', async () => {
    // Airplane mode: no network at all.
    useNetworkStore.setState({isOnline: false, isConnected: false});
    const error = await download().catch((e: unknown) => e);
    expect(downloadFailureReason(error)).toBe('offline');
    expect(fs.createDownloadResumable).not.toHaveBeenCalled();
  });

  it('still downloads on iOS when only the internet check failed', async () => {
    // On a network that blocks the Google URL NetInfo checks, or where the
    // check timed out. The audio server can still answer there.
    useNetworkStore.setState({isOnline: false, isConnected: true});
    await expect(download()).resolves.toMatchObject({fileSize: 5000});
    expect(fs.createDownloadResumable).toHaveBeenCalledTimes(1);
  });

  it('still tries on Android, which fails by itself', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    useNetworkStore.setState({isOnline: false, isConnected: false});
    await expect(download()).resolves.toMatchObject({fileSize: 5000});
  });
});

describe('stopping a download', () => {
  it('rejects as cancelled at once and removes the partial file', async () => {
    // The native side never answers: the file is waiting for a connection.
    transfer = uri => {
      files.set(uri, 900);
      return new Promise(() => undefined);
    };
    let cancel: (() => void) | undefined;
    const pending = downloadSurah(1, 'reciter', 'rewayah', undefined, {
      onStart: stop => {
        cancel = stop;
      },
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(fs.createDownloadResumable).toHaveBeenCalledTimes(1);

    cancel?.();
    const error = await pending.catch((e: unknown) => e);
    expect(downloadFailureReason(error)).toBe('cancelled');
    expect(cancelAsync).toHaveBeenCalledTimes(1);
    expect(files.size).toBe(0);
  });

  it('reports a plain failure as failed', async () => {
    transfer = async () => {
      throw new Error('connection lost');
    };
    const error = await download().catch((e: unknown) => e);
    expect(downloadFailureReason(error)).toBe('failed');
  });
});
