import * as FileSystem from 'expo-file-system/legacy';
import {AppState} from 'react-native';
import * as mockRecitation from '@/test-utils/recitationMocks';
import {mockEngine} from '@/test-utils/recitationMocks';
import {createRecitationEngine} from '../recitationEngine';

// The real engineHost on the real recitationAssets, with the file system stubbed:
// what a new install goes through on a network where the follower's files arrive
// and the second look's model never does.

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  createDownloadResumable: jest.fn(),
}));
jest.mock(
  '@/services/recitation/recitationEngine',
  () => mockRecitation.recitationEngineModule,
);
jest.mock(
  '@/services/analytics/AnalyticsService',
  () => mockRecitation.analyticsModule,
);
jest.mock('@/services/recitation/secondLook/checkWord', () => ({
  unloadSecondLook: jest.fn(async () => undefined),
}));

const SIZES: Record<string, number> = {
  'zipformer_a0w_ep1_a05.int8.onnx': 69246033,
  'zipformer_quran.json': 5453439,
};

const fs = FileSystem as unknown as {
  getInfoAsync: jest.Mock;
  createDownloadResumable: jest.Mock;
};

let host: typeof import('../engineHost');
let files: Map<string, number>;

beforeEach(() => {
  jest.clearAllMocks();
  files = new Map();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({remove: jest.fn()} as unknown as ReturnType<
      typeof AppState.addEventListener
    >);
  fs.getInfoAsync.mockImplementation(async (uri: string) => {
    const size = files.get(uri);
    return size === undefined
      ? {exists: false, isDirectory: false}
      : {exists: true, isDirectory: false, size};
  });
  fs.createDownloadResumable.mockImplementation(
    (
      _url: string,
      uri: string,
      _options: unknown,
      onProgress: (data: {totalBytesWritten: number}) => void,
    ) => ({
      downloadAsync: async () => {
        const size = SIZES[uri.split('/').pop() ?? ''];
        // Not one of the follower's: it waits for a network that never comes.
        if (size === undefined) await new Promise(() => undefined);
        onProgress({totalBytesWritten: size});
        files.set(uri, size);
        return {status: 200};
      },
    }),
  );
  jest.isolateModules(() => {
    host = require('../engineHost');
  });
});

afterEach(async () => {
  await host.unloadRecitationModel();
  jest.restoreAllMocks();
});

describe('a new install whose second look download never ends', () => {
  it('still starts the follower, and the bar still reaches the end', async () => {
    const progress: number[] = [];
    const onLoad = jest.fn();
    const {engine} = await host.acquireEngine({
      onDownload: p => progress.push(p),
      onLoad,
    });
    expect(engine).toBe(mockEngine);
    expect(createRecitationEngine).toHaveBeenCalledTimes(1);
    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBeCloseTo(1);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('a second session after the first does not wait either', async () => {
    const callbacks = {onDownload: () => undefined, onLoad: () => undefined};
    await host.acquireEngine(callbacks);
    await expect(host.acquireEngine(callbacks)).resolves.toEqual({
      engine: mockEngine,
      wasLoaded: true,
    });
    await expect(host.recitationModelNeedsDownload()).resolves.toBe(false);
  });
});
