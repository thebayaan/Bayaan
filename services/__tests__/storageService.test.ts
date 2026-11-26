// @ai-generated
/**
 * Settings > Storage on a stubbed file system: what the Cache figure counts
 * and what "Clear cache" deletes.
 */
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  readDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));
jest.mock('react-native-device-info', () => ({}));
let mockDownloads: Array<{filePath: string; fileSize: number}> = [];
jest.mock('../player/store/downloadStore', () => ({
  useDownloadStore: {getState: () => ({downloads: mockDownloads})},
}));
jest.mock('../downloadService', () => ({
  resolveFilePath: (name: string) => `file:///docs/${name}`,
}));

import {
  clearCacheDirectory,
  getCacheStorage,
  getDownloadsStorage,
} from '../storageService';

const fs = FileSystem as unknown as {
  readDirectoryAsync: jest.Mock;
  getInfoAsync: jest.Mock;
  deleteAsync: jest.Mock;
};

interface Entry {
  size?: number;
  children?: Record<string, Entry>;
}

/** The fake cache folder. */
let root: Record<string, Entry>;

function find(uri: string): Entry | undefined {
  const parts = uri.replace('file:///cache/', '').split('/').filter(Boolean);
  let children: Record<string, Entry> | undefined = root;
  let entry: Entry | undefined;
  for (const part of parts) {
    entry = children?.[part];
    children = entry?.children;
  }
  return parts.length === 0 ? {children: root} : entry;
}

function sizeOf(entry: Entry): number {
  if (!entry.children) return entry.size ?? 0;
  return Object.values(entry.children).reduce(
    (total, child) => total + sizeOf(child),
    0,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  fs.readDirectoryAsync.mockImplementation(async (uri: string) =>
    Object.keys(find(uri)?.children ?? {}),
  );
  fs.getInfoAsync.mockImplementation(async (uri: string) => {
    const entry = find(uri);
    // As on both platforms, a folder's size is everything inside it.
    return entry
      ? {exists: true, isDirectory: !!entry.children, size: sizeOf(entry)}
      : {exists: false, isDirectory: false};
  });
  fs.deleteAsync.mockImplementation(async (uri: string) => {
    const name = uri.replace('file:///cache/', '').replace(/\/$/, '');
    if (name === 'locked') throw new Error('not permitted');
    delete root[name];
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('clearCacheDirectory', () => {
  it('deletes files and folders in the cache folder', async () => {
    root = {
      'bayaan-share.png': {size: 10},
      DocumentPicker: {children: {'a.mp3': {size: 500}}},
    };
    await clearCacheDirectory();
    expect(root).toEqual({});
  });

  it('leaves folders that are in use while the app runs', async () => {
    root = {
      'com.apple.nsurlsessiond': {children: {'download.tmp': {size: 900}}},
      'io.sentry': {children: {}},
      sentry: {children: {}},
      images: {children: {'a.jpg': {size: 20}}},
    };
    await clearCacheDirectory();
    expect(Object.keys(root).sort()).toEqual([
      'com.apple.nsurlsessiond',
      'io.sentry',
      'sentry',
    ]);
  });

  it('leaves the CarPlay and Android Auto artwork folder', async () => {
    // iOS makes bayaan-car/artwork once, at launch, and saves artwork with
    // `try?`: deleted, nothing was saved to disk until the next launch.
    root = {
      'bayaan-car': {children: {artwork: {children: {'a.png': {size: 30}}}}},
      images: {children: {'a.jpg': {size: 20}}},
    };
    await clearCacheDirectory();
    expect(Object.keys(root)).toEqual(['bayaan-car']);
    await expect(getCacheStorage()).resolves.toBe(0);
  });

  it('carries on past an entry that cannot be deleted', async () => {
    root = {locked: {size: 1}, 'z.tmp': {size: 2}};
    await expect(clearCacheDirectory()).resolves.toBeUndefined();
    expect(Object.keys(root)).toEqual(['locked']);
  });
});

describe('getCacheStorage', () => {
  it('counts what is inside folders, not only loose files', async () => {
    root = {
      'bayaan-share.png': {size: 10},
      DocumentPicker: {
        children: {'a.mp3': {size: 500}, nested: {children: {b: {size: 40}}}},
      },
    };
    await expect(getCacheStorage()).resolves.toBe(550);
  });

  it('leaves out the folders Clear cache does not touch', async () => {
    root = {
      'com.apple.nsurlsessiond': {children: {'download.tmp': {size: 900}}},
      images: {children: {'a.jpg': {size: 20}}},
    };
    await expect(getCacheStorage()).resolves.toBe(20);
  });
});

describe('getDownloadsStorage', () => {
  it('reads the file for downloads that were recorded with size 0', async () => {
    mockDownloads = [
      {filePath: 'a.mp3', fileSize: 300},
      {filePath: 'b.mp3', fileSize: 0},
      {filePath: 'gone.mp3', fileSize: 0},
    ];
    fs.getInfoAsync.mockImplementation(async (uri: string) =>
      uri === 'file:///docs/b.mp3'
        ? {exists: true, isDirectory: false, size: 700}
        : {exists: false, isDirectory: false},
    );
    await expect(getDownloadsStorage()).resolves.toBe(1000);
    // The recorded size is trusted when there is one.
    expect(fs.getInfoAsync).not.toHaveBeenCalledWith('file:///docs/a.mp3');
  });
});
