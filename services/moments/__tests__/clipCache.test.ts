// @ai-start
jest.mock('expo-file-system/legacy', () => {
  // In-memory folder: path -> size in bytes.
  const files = new Map<string, number>();
  const sizes = new Map<string, number>();
  const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
  return {
    cacheDirectory: 'file:///cache/',
    __files: files,
    __sizes: sizes,
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
    readDirectoryAsync: jest.fn(async (dir: string) =>
      [...files.keys()]
        .filter(p => dirOf(p) === dir)
        .map(p => p.slice(dir.length)),
    ),
    getInfoAsync: jest.fn(async (path: string) =>
      files.has(path)
        ? {exists: true, isDirectory: false, size: files.get(path)}
        : {exists: false, isDirectory: false},
    ),
    downloadAsync: jest.fn(async (url: string, to: string) => {
      files.set(to, sizes.get(url) ?? 1);
      return {status: 200};
    }),
    moveAsync: jest.fn(async ({from, to}: {from: string; to: string}) => {
      files.set(to, files.get(from)!);
      files.delete(from);
    }),
    deleteAsync: jest.fn(async (path: string) => {
      for (const p of [...files.keys()]) {
        if (p === path || p.startsWith(path.endsWith('/') ? path : `${path}/`))
          files.delete(p);
      }
    }),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      __mockStore: store,
    },
  };
});

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CachedClipEntry,
  clipFileName,
  MOMENTS_CACHE_INDEX_KEY,
  MomentsClipCache,
  planEviction,
} from '../clipCache';

const fs = FileSystem as unknown as {
  __files: Map<string, number>;
  __sizes: Map<string, number>;
};
const mockStore = (
  AsyncStorage as unknown as {__mockStore: Map<string, string>}
).__mockStore;
const DIR = 'file:///cache/moments-clips/';

function clip(id: string, size: number) {
  const url = `https://cdn.example.test/clips/${id}.mp3`;
  fs.__sizes.set(url, size);
  return {id, url};
}

describe('planEviction', () => {
  const entries: CachedClipEntry[] = [
    {fileName: 'a.mp3', size: 40, lastUsedAt: 3},
    {fileName: 'b.mp3', size: 40, lastUsedAt: 1},
    {fileName: 'c.mp3', size: 40, lastUsedAt: 2},
  ];

  it('keeps everything under the cap', () => {
    expect(planEviction(entries, 120)).toEqual([]);
  });

  it('evicts least recently used first until it fits', () => {
    expect(planEviction(entries, 100)).toEqual(['b.mp3']);
    expect(planEviction(entries, 40)).toEqual(['b.mp3', 'c.mp3']);
  });

  it('never evicts protected clips, even if that leaves it over the cap', () => {
    expect(planEviction(entries, 40, new Set(['b.mp3']))).toEqual([
      'c.mp3',
      'a.mp3',
    ]);
    expect(
      planEviction(entries, 0, new Set(['a.mp3', 'b.mp3', 'c.mp3'])),
    ).toEqual([]);
  });
});

describe('clipFileName', () => {
  it('sanitizes the id and keeps the extension', () => {
    expect(clipFileName('a/b:c', 'https://x.test/c.M4A?sig=1')).toBe(
      'a_b_c.m4a',
    );
    expect(clipFileName('id', 'https://x.test/clip')).toBe('id.mp3');
  });
});

describe('MomentsClipCache', () => {
  let now = 0;
  let cache: MomentsClipCache;

  beforeEach(() => {
    fs.__files.clear();
    fs.__sizes.clear();
    mockStore.clear();
    jest.clearAllMocks();
    now = 1_000;
    cache = new MomentsClipCache(100, () => now++);
  });

  it('downloads clips into its folder and serves them locally', async () => {
    const a = clip('a', 30);
    expect(cache.getLocalUri(a)).toBeNull();
    cache.prefetch([a]);
    await cache.idle();
    expect(cache.getLocalUri(a)).toBe(`${DIR}a.mp3`);
    expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
      a.url,
      `${DIR}a.mp3.download`,
    );
    expect(await cache.getSize()).toBe(30);
  });

  it('evicts the least recently played clip once over the cap', async () => {
    const [a, b, c] = [clip('a', 40), clip('b', 40), clip('c', 40)];
    cache.prefetch([a, b]);
    await cache.idle();
    // a was played after both downloads; b only downloaded.
    cache.markPlayed(a);
    cache.prefetch([c], [c]);
    await cache.idle();
    expect(cache.getLocalUri(a)).not.toBeNull();
    expect(cache.getLocalUri(b)).toBeNull();
    expect(cache.getLocalUri(c)).not.toBeNull();
    expect(fs.__files.has(`${DIR}b.mp3`)).toBe(false);
    expect(await cache.getSize()).toBe(80);
  });

  it('keeps the cards around the one on screen', async () => {
    const [a, b, c] = [clip('a', 40), clip('b', 40), clip('c', 40)];
    cache.prefetch([a, b]);
    await cache.idle();
    cache.markPlayed(b);
    // a is the oldest, but every clip is around the card on screen, so
    // nothing is deleted and the cache stays over the cap for now.
    cache.prefetch([c], [a, b, c]);
    await cache.idle();
    expect([a, b, c].map(r => cache.getLocalUri(r) !== null)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('does not download a clip it already has', async () => {
    const a = clip('a', 10);
    cache.prefetch([a]);
    await cache.idle();
    cache.prefetch([a]);
    await cache.idle();
    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1);
  });

  it('forgets a failed download', async () => {
    const a = clip('a', 10);
    jest.mocked(FileSystem.downloadAsync).mockResolvedValueOnce({
      status: 404,
    } as FileSystem.FileSystemDownloadResult);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    cache.prefetch([a]);
    await cache.idle();
    expect(cache.getLocalUri(a)).toBeNull();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      `${DIR}a.mp3.download`,
      {idempotent: true},
    );
  });

  it('reconciles its index with the folder on open', async () => {
    fs.__files.set(`${DIR}kept.mp3`, 20);
    fs.__files.set(`${DIR}stray.mp3.download`, 5);
    mockStore.set(
      MOMENTS_CACHE_INDEX_KEY,
      JSON.stringify({
        'kept.mp3': {fileName: 'kept.mp3', size: 20, lastUsedAt: 1},
        'gone.mp3': {fileName: 'gone.mp3', size: 20, lastUsedAt: 1},
      }),
    );
    await cache.init();
    expect(
      cache.getLocalUri({id: 'kept', url: 'https://x.test/kept.mp3'}),
    ).toBe(`${DIR}kept.mp3`);
    expect(
      cache.getLocalUri({id: 'gone', url: 'https://x.test/gone.mp3'}),
    ).toBeNull();
    expect(fs.__files.has(`${DIR}stray.mp3.download`)).toBe(false);
    expect(
      Object.keys(JSON.parse(mockStore.get(MOMENTS_CACHE_INDEX_KEY)!)),
    ).toEqual(['kept.mp3']);
  });

  it('clears every clip', async () => {
    cache.prefetch([clip('a', 10), clip('b', 10)]);
    await cache.idle();
    await cache.clear();
    expect(await cache.getSize()).toBe(0);
    expect(cache.getLocalUri(clip('a', 10))).toBeNull();
    expect(JSON.parse(mockStore.get(MOMENTS_CACHE_INDEX_KEY)!)).toEqual({});
  });
});
// @ai-end
