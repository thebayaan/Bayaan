// @ai-generated
// The setup error screen offers "Try again", which calls bootApp() a second
// time. That only helps if a failed boot really starts over, and a boot that
// is running or done is never run twice.
const mockAudioInit = jest.fn<Promise<void>, []>();
const mockInitializeServices = jest.fn<Promise<void>, []>();
const mockGetAllReciters = jest.fn<Promise<unknown[]>, []>();
const mockRestoreSession = jest.fn<Promise<void>, []>();
const mockMarkSessionRestored = jest.fn();

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {initialize: () => mockAudioInit()},
}));
jest.mock('@/services/AppInitializer', () => ({
  appInitializer: {initialize: () => mockInitializeServices()},
}));
jest.mock('@/services/dataService', () => ({
  getAllReciters: () => mockGetAllReciters(),
}));
jest.mock('@/services/player/utils/restoreSession', () => ({
  restoreSession: () => mockRestoreSession(),
}));
jest.mock('@/services/car/sessionGate', () => ({
  markSessionRestored: () => mockMarkSessionRestored(),
}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {getState: () => ({})},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({})},
}));
jest.mock('@/services/persistedStores', () => ({PERSISTED_STORES: []}));
jest.mock('@/services/rehydrateOnForeground', () => ({
  initForegroundRehydration: jest.fn(),
}));

type BootApp = typeof import('../appBoot').bootApp;

/** A fresh JS runtime: bootApp() has not run yet. */
function freshBootApp(): BootApp {
  let bootApp!: BootApp;
  jest.isolateModules(() => {
    bootApp = require('../appBoot').bootApp;
  });
  return bootApp;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAudioInit.mockResolvedValue(undefined);
  mockInitializeServices.mockResolvedValue(undefined);
  mockGetAllReciters.mockResolvedValue([]);
  mockRestoreSession.mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('bootApp', () => {
  it('starts over after a failed boot', async () => {
    const bootApp = freshBootApp();
    mockInitializeServices.mockRejectedValueOnce(new Error('database failed'));

    await expect(bootApp()).rejects.toThrow('database failed');
    expect(mockMarkSessionRestored).not.toHaveBeenCalled();

    await expect(bootApp()).resolves.toBeUndefined();

    expect(mockAudioInit).toHaveBeenCalledTimes(2);
    expect(mockInitializeServices).toHaveBeenCalledTimes(2);
    expect(mockRestoreSession).toHaveBeenCalledTimes(1);
    expect(mockMarkSessionRestored).toHaveBeenCalledTimes(1);
  });

  it('runs one boot for callers that overlap, and none after it is done', async () => {
    const bootApp = freshBootApp();

    await Promise.all([bootApp(), bootApp()]);
    await bootApp();

    expect(mockAudioInit).toHaveBeenCalledTimes(1);
    expect(mockInitializeServices).toHaveBeenCalledTimes(1);
    expect(mockRestoreSession).toHaveBeenCalledTimes(1);
  });
});
