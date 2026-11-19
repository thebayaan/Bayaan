import {loadAudioInBackground, pendingRestoreLoad} from '../restoreSession';

let mockOpId = 0;
let mockCarReplacedQueue = false; // @ai
const mockLoadTrack = jest.fn<Promise<void>, [string]>();
const mockSeekTo = jest.fn<Promise<void>, [number]>();

// @ai-start
const mockUpdatePlaybackState = jest.fn();
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({updatePlaybackState: mockUpdatePlaybackState}),
  },
  currentPlayOpId: () => mockOpId,
  setTrackUrlResolver: jest.fn(),
}));
jest.mock('@/services/uploads/UploadsService', () => ({
  resolveRecitationPath: (name: string) => `file:///now/${name}`,
}));
// @ai-end
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    loadTrack: (url: string) => mockLoadTrack(url),
    seekTo: (sec: number) => mockSeekTo(sec),
  },
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {},
}));
jest.mock('@/services/dataService', () => ({}));
jest.mock('@/utils/audioUtils', () => ({}));
jest.mock('@/utils/artworkUtils', () => ({}));
jest.mock('@/store/uploadsStore', () => ({useUploadsStore: {}}));
jest.mock('@/utils/track', () => ({}));
jest.mock('@/services/car/sessionGate', () => ({
  hasCarReplacedQueue: () => mockCarReplacedQueue, // @ai
}));

describe('restoreSession background load', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockOpId = 0;
    mockCarReplacedQueue = false; // @ai
    mockLoadTrack.mockReset();
    mockLoadTrack.mockResolvedValue(undefined);
    mockSeekTo.mockReset();
    mockSeekTo.mockResolvedValue(undefined);
    mockUpdatePlaybackState.mockReset(); // @ai
  });
  afterEach(() => jest.useRealTimers());

  // @ai-start
  it('puts the restored position back in the store after the seek', async () => {
    // The player's first status after a load reports 0:00 and is written
    // to the store; without this the slider and the recent card showed the
    // start of the surah until playback began.
    loadAudioInBackground('u1', 30);
    jest.advanceTimersByTime(100);
    await pendingRestoreLoad();

    expect(mockUpdatePlaybackState).toHaveBeenCalledWith({position: 30});
  });

  it('leaves the store position alone when a newer play started', async () => {
    mockLoadTrack.mockImplementation(async () => {
      mockOpId += 1;
    });
    loadAudioInBackground('u1', 30);
    jest.advanceTimersByTime(100);
    await pendingRestoreLoad();

    expect(mockUpdatePlaybackState).not.toHaveBeenCalled();
  });
  // @ai-end

  it('loads and seeks when no newer play started', async () => {
    loadAudioInBackground('u1', 30);
    jest.advanceTimersByTime(100);
    await pendingRestoreLoad();
    expect(mockLoadTrack).toHaveBeenCalledWith('u1');
    expect(mockSeekTo).toHaveBeenCalledWith(30);
  });

  it('skips the load when a play claimed a newer op before it ran', async () => {
    loadAudioInBackground('u1', 30);
    mockOpId += 1;
    jest.advanceTimersByTime(100);
    await pendingRestoreLoad();
    expect(mockLoadTrack).not.toHaveBeenCalled();
    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('skips the seek when a play started during the load', async () => {
    mockLoadTrack.mockImplementation(async () => {
      mockOpId += 1;
    });
    loadAudioInBackground('u1', 30);
    jest.advanceTimersByTime(100);
    await pendingRestoreLoad();
    expect(mockLoadTrack).toHaveBeenCalled();
    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('pendingRestoreLoad stays pending until the load settles', async () => {
    let finish: () => void = () => undefined;
    mockLoadTrack.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    loadAudioInBackground('u1', 0);
    let settled = false;
    void pendingRestoreLoad().then(() => {
      settled = true;
    });
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    await pendingRestoreLoad();
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  // @ai-start
  it('settles pendingRestoreLoad when a car took the queue before the load ran', async () => {
    loadAudioInBackground('u1', 30);
    mockCarReplacedQueue = true;
    let settled = false;
    void pendingRestoreLoad().then(() => {
      settled = true;
    });
    jest.advanceTimersByTime(100);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(settled).toBe(true);
    expect(mockLoadTrack).not.toHaveBeenCalled();
    expect(mockSeekTo).not.toHaveBeenCalled();
  });
  // @ai-end
});
