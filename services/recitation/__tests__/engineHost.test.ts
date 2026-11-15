import {AppState} from 'react-native';
import * as mockRecitation from '@/test-utils/recitationMocks';
import {
  mockEngine,
  resetRecitationControls,
} from '@/test-utils/recitationMocks';
import {
  RECITATION_DOWNLOAD_MB,
  RECITATION_FOLLOWER_MB,
} from '@/constants/recitation';

jest.mock(
  '@/services/recitation/recitationEngine',
  () => mockRecitation.recitationEngineModule,
);
jest.mock(
  '@/services/recitation/recitationAssets',
  () => mockRecitation.recitationAssetsModule,
);
jest.mock(
  '@/services/analytics/AnalyticsService',
  () => mockRecitation.analyticsModule,
);
const mockUnloadSecondLook = jest.fn(async () => undefined);
jest.mock('@/services/recitation/secondLook/checkWord', () => ({
  unloadSecondLook: mockUnloadSecondLook,
}));

type Host = typeof import('../engineHost');
let host: Host;
let memoryWarning: () => void;

const CALLBACKS = {onDownload: () => undefined, onLoad: () => undefined};

beforeEach(() => {
  jest.clearAllMocks();
  resetRecitationControls();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((type: string, listener: (next: never) => void) => {
      if (type === 'memoryWarning') memoryWarning = listener as () => void;
      return {remove: jest.fn()} as unknown as ReturnType<
        typeof AppState.addEventListener
      >;
    });
  jest.isolateModules(() => {
    host = require('../engineHost');
  });
});

afterEach(async () => {
  host.markEngineBusy(false);
  await host.unloadRecitationModel();
  jest.restoreAllMocks();
});

describe('what is on the phone', () => {
  const FOLLOWER = {
    modelPath: 'file:///model.onnx',
    corpusPath: 'file:///corpus.json',
  };

  it('with both models, the whole download', async () => {
    mockRecitation.recitationAssetsModule.getRecitationAssets.mockResolvedValueOnce(
      FOLLOWER,
    );
    mockRecitation.recitationAssetsModule.secondLookModelPath.mockResolvedValueOnce(
      'file:///second.onnx',
    );
    expect(await host.recitationModelOnPhone()).toEqual({
      downloaded: true,
      sizeMb: RECITATION_DOWNLOAD_MB,
    });
  });

  it("with the follower's files alone, those", async () => {
    mockRecitation.recitationAssetsModule.getRecitationAssets.mockResolvedValueOnce(
      FOLLOWER,
    );
    mockRecitation.recitationAssetsModule.secondLookModelPath.mockResolvedValueOnce(
      null,
    );
    expect(await host.recitationModelOnPhone()).toEqual({
      downloaded: true,
      sizeMb: RECITATION_FOLLOWER_MB,
    });
    expect(RECITATION_FOLLOWER_MB).toBe(75);
  });

  it('with nothing yet, the size of the whole download', async () => {
    mockRecitation.recitationAssetsModule.getRecitationAssets.mockResolvedValueOnce(
      null as never,
    );
    mockRecitation.recitationAssetsModule.secondLookModelPath.mockResolvedValueOnce(
      null,
    );
    expect(await host.recitationModelOnPhone()).toEqual({
      downloaded: false,
      sizeMb: RECITATION_DOWNLOAD_MB,
    });
  });
});

describe('engineHost and the second look', () => {
  it('unloading the model lets the second look go with it', async () => {
    await host.acquireEngine(CALLBACKS);
    await host.unloadRecitationModel();
    expect(mockEngine.dispose).toHaveBeenCalledTimes(1);
    expect(mockUnloadSecondLook).toHaveBeenCalledTimes(1);
  });

  it('while a session uses them, neither is unloaded', async () => {
    await host.acquireEngine(CALLBACKS);
    host.markEngineBusy(true);
    await host.unloadRecitationModel();
    expect(mockEngine.dispose).not.toHaveBeenCalled();
    expect(mockUnloadSecondLook).not.toHaveBeenCalled();
  });

  it('a memory warning mid-take takes the second look only: it is optional', async () => {
    await host.acquireEngine(CALLBACKS);
    host.markEngineBusy(true);
    memoryWarning();
    expect(mockUnloadSecondLook).toHaveBeenCalledTimes(1);
    expect(mockEngine.dispose).not.toHaveBeenCalled();
  });

  it('a memory warning between takes takes both', async () => {
    await host.acquireEngine(CALLBACKS);
    memoryWarning();
    await Promise.resolve();
    expect(mockUnloadSecondLook).toHaveBeenCalled();
    expect(mockEngine.dispose).toHaveBeenCalledTimes(1);
  });
});
