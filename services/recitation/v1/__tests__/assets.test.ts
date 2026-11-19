import * as FileSystem from 'expo-file-system/legacy';
import {
  deleteV1Assets,
  ensureV1Assets,
  getV1Assets,
  V1_MODEL,
  V1_REFERENCE,
} from '../assets';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  createDownloadResumable: jest.fn(),
}));

const mockEnsureSecondLook = jest.fn(async () => undefined);
jest.mock('../../recitationAssets', () => ({
  ensureSecondLookModel: () => mockEnsureSecondLook(),
}));

const DIR = 'file:///docs/recitation/v1/';
const MODEL = `${DIR}spliced-clean-1-int8.onnx`;
const REFERENCE = `${DIR}ref-v2.json`;
const SIZES: Record<string, number> = {
  [MODEL]: V1_MODEL.bytes,
  [REFERENCE]: V1_REFERENCE.bytes,
};

const fs = FileSystem as unknown as {
  getInfoAsync: jest.Mock;
  createDownloadResumable: jest.Mock;
  deleteAsync: jest.Mock;
};

let files: Map<string, number>;
let downloads: string[];
// A download writes this many bytes instead of the right size.
let shortBy: Map<string, number>;

beforeEach(() => {
  jest.clearAllMocks();
  files = new Map();
  downloads = [];
  shortBy = new Map();
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
      report: (data: {totalBytesWritten: number}) => void,
    ) => ({
      downloadAsync: async () => {
        downloads.push(url);
        const size = SIZES[uri] - (shortBy.get(uri) ?? 0);
        report({totalBytesWritten: size / 2});
        report({totalBytesWritten: size});
        files.set(uri, size);
        return {status: 200};
      },
    }),
  );
});

describe('getV1Assets', () => {
  it('is null until both files are there at their pinned sizes', async () => {
    expect(await getV1Assets()).toBeNull();
    files.set(MODEL, V1_MODEL.bytes);
    expect(await getV1Assets()).toBeNull();
    files.set(REFERENCE, V1_REFERENCE.bytes - 1);
    expect(await getV1Assets()).toBeNull();
    files.set(REFERENCE, V1_REFERENCE.bytes);
    expect(await getV1Assets()).toEqual({
      modelPath: MODEL,
      referencePath: REFERENCE,
    });
  });
});

describe('ensureV1Assets', () => {
  it('downloads the reference, the model and the second model, with progress to 1', async () => {
    const progress: number[] = [];
    const paths = await ensureV1Assets(p => progress.push(p));
    expect(paths).toEqual({modelPath: MODEL, referencePath: REFERENCE});
    expect(downloads).toEqual([V1_REFERENCE.url, V1_MODEL.url]);
    expect(mockEnsureSecondLook).toHaveBeenCalledTimes(1);
    expect(progress[progress.length - 1]).toBeCloseTo(1);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
    }
  });

  it('skips files already there', async () => {
    files.set(REFERENCE, V1_REFERENCE.bytes);
    await ensureV1Assets(() => undefined);
    expect(downloads).toEqual([V1_MODEL.url]);
  });

  it('a truncated download is deleted and fails', async () => {
    shortBy.set(MODEL, 1000);
    await expect(ensureV1Assets(() => undefined)).rejects.toThrow(
      /Download failed/,
    );
    expect(fs.deleteAsync).toHaveBeenCalledWith(MODEL, {idempotent: true});
    expect(mockEnsureSecondLook).not.toHaveBeenCalled();
  });

  it('fails when the second model cannot be fetched', async () => {
    mockEnsureSecondLook.mockRejectedValueOnce(new Error('offline'));
    await expect(ensureV1Assets(() => undefined)).rejects.toThrow('offline');
  });
});

describe('deleteV1Assets', () => {
  it('removes only the v1 directory', async () => {
    await deleteV1Assets();
    expect(fs.deleteAsync).toHaveBeenCalledWith(DIR, {idempotent: true});
  });
});
