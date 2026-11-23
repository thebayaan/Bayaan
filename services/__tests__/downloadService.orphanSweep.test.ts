// @ai-generated
/**
 * The iOS sweep of downloads that a killed launch left behind: it deletes only
 * the CFNetworkDownload_*.tmp files of the background session folder, it runs
 * once in each launch, and the first download of the launch waits for it.
 */
const CACHE = 'file:///caches/';
const ROOT = `${CACHE}com.apple.nsurlsessiond/Downloads/`;
const BUNDLE = `${ROOT}com.example.app/`;

interface FakeFs {
  documentDirectory: string;
  cacheDirectory: string | null;
  getInfoAsync: jest.Mock;
  readDirectoryAsync: jest.Mock;
  deleteAsync: jest.Mock;
  moveAsync: jest.Mock;
  createDownloadResumable: jest.Mock;
}

/** The fake disk: a uri, and whether it is a folder. */
let disk: Map<string, 'dir' | 'file'>;
/** What happened, in order: 'delete <uri>' and 'transfer'. */
let events: string[];
let fs: FakeFs;

/** A fresh launch: new module state, on the given platform. */
function load(os: 'ios' | 'android' = 'ios') {
  jest.resetModules();
  require('react-native').Platform.OS = os;
  jest.doMock('expo-file-system/legacy', () => fs);
  jest.doMock('../dataService', () => ({
    fetchAudioUrl: jest.fn(async () => 'https://cdn.test/hafs/001.mp3'),
  }));
  require('@/store/networkStore').useNetworkStore.setState({
    isOnline: true,
    isConnected: true,
  });
  return require('../downloadService') as typeof import('../downloadService');
}

function children(dir: string): string[] {
  return [...disk.keys()]
    .filter(uri => uri.startsWith(dir) && uri !== dir)
    .map(uri => uri.slice(dir.length).replace(/\/$/, ''))
    .filter(name => !name.includes('/'));
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  events = [];
  disk = new Map([
    [ROOT, 'dir'],
    [BUNDLE, 'dir'],
    [`${BUNDLE}CFNetworkDownload_5j9dOa.tmp`, 'file'],
    [`${BUNDLE}CFNetworkDownload_yZLe5Z.tmp`, 'file'],
    [`${BUNDLE}notes.json`, 'file'],
  ]);
  fs = {
    documentDirectory: 'file:///docs/',
    cacheDirectory: CACHE,
    getInfoAsync: jest.fn(async (uri: string) => {
      const kind = disk.get(uri) ?? disk.get(`${uri}/`);
      if (!kind) return {exists: false, isDirectory: false};
      return {exists: true, isDirectory: kind === 'dir', size: 5000};
    }),
    readDirectoryAsync: jest.fn(async (dir: string) => {
      if (disk.get(dir) !== 'dir') throw new Error(`no folder at ${dir}`);
      return children(dir);
    }),
    deleteAsync: jest.fn(async (uri: string) => {
      // The partial file of a download is not part of the sweep.
      if (uri.startsWith(CACHE)) events.push(`delete ${uri}`);
      disk.delete(uri);
    }),
    moveAsync: jest.fn(async ({from, to}: {from: string; to: string}) => {
      disk.delete(from);
      disk.set(to, 'file');
    }),
    createDownloadResumable: jest.fn((_url: string, uri: string) => ({
      downloadAsync: async () => {
        events.push('transfer');
        disk.set(uri, 'file');
        return {status: 200, headers: {'Content-Length': '5000'}};
      },
      cancelAsync: jest.fn(async () => undefined),
    })),
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

const orphan = (name: string) => `delete ${BUNDLE}${name}`;

describe('sweepOrphanedDownloads', () => {
  it('deletes the orphaned session files and nothing else', async () => {
    await load().sweepOrphanedDownloads();

    expect(events).toEqual([
      orphan('CFNetworkDownload_5j9dOa.tmp'),
      orphan('CFNetworkDownload_yZLe5Z.tmp'),
    ]);
    expect(disk.has(`${BUNDLE}notes.json`)).toBe(true);
  });

  it('runs once in each launch', async () => {
    const service = load();
    await service.sweepOrphanedDownloads();
    disk.set(`${BUNDLE}CFNetworkDownload_later.tmp`, 'file');

    await service.sweepOrphanedDownloads();

    expect(disk.has(`${BUNDLE}CFNetworkDownload_later.tmp`)).toBe(true);
  });

  it('runs before the first download of the launch starts', async () => {
    await load().downloadSurah(1, 'reciter', 'rewayah');

    const firstTransfer = events.indexOf('transfer');
    expect(firstTransfer).toBeGreaterThan(-1);
    expect(events.indexOf(orphan('CFNetworkDownload_5j9dOa.tmp'))).toBeLessThan(
      firstTransfer,
    );
    expect(events.indexOf(orphan('CFNetworkDownload_yZLe5Z.tmp'))).toBeLessThan(
      firstTransfer,
    );
  });

  it('does not stop a download when the sweep fails', async () => {
    fs.readDirectoryAsync.mockRejectedValue(new Error('EACCES'));

    const result = await load().downloadSurah(1, 'reciter', 'rewayah');

    expect(result.fileSize).toBe(5000);
    expect(events).toEqual(['transfer']);
  });

  it('does nothing when the folder is not there', async () => {
    disk = new Map();

    await load().sweepOrphanedDownloads();

    expect(fs.readDirectoryAsync).not.toHaveBeenCalled();
    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });

  it('does nothing on Android', async () => {
    await load('android').sweepOrphanedDownloads();

    expect(fs.getInfoAsync).not.toHaveBeenCalled();
    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });
});
