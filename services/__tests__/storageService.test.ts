// @ai-generated
/**
 * Settings > Storage on a stubbed file system: what "Clear cache" deletes.
 */
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  readDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));
jest.mock('react-native-device-info', () => ({}));
jest.mock('../player/store/downloadStore', () => ({
  useDownloadStore: {getState: () => ({downloads: []})},
}));

import {clearCacheDirectory} from '../storageService';

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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  fs.readDirectoryAsync.mockImplementation(async (uri: string) =>
    Object.keys(find(uri)?.children ?? {}),
  );
  fs.getInfoAsync.mockImplementation(async (uri: string) => {
    const entry = find(uri);
    return entry
      ? {exists: true, isDirectory: !!entry.children, size: entry.size ?? 0}
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

  it('carries on past an entry that cannot be deleted', async () => {
    root = {locked: {size: 1}, 'z.tmp': {size: 2}};
    await expect(clearCacheDirectory()).resolves.toBeUndefined();
    expect(Object.keys(root)).toEqual(['locked']);
  });
});
