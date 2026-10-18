import {loadAudioInBackground, pendingRestoreLoad} from '../restoreSession';

let mockOpId = 0;
const mockLoadTrack = jest.fn<Promise<void>, [string]>();
const mockSeekTo = jest.fn<Promise<void>, [number]>();

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {},
  currentPlayOpId: () => mockOpId,
}));
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

describe('restoreSession background load', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockOpId = 0;
    mockLoadTrack.mockReset();
    mockLoadTrack.mockResolvedValue(undefined);
    mockSeekTo.mockReset();
    mockSeekTo.mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());

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
});
