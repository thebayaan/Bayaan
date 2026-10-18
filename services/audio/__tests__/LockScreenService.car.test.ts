const mockSetActive = jest.fn();
const mockPlayer = {
  setActiveForLockScreen: mockSetActive,
  clearLockScreenControls: jest.fn(),
};
const mockTrack = {id: 't1', title: 'Al-Fatihah', artist: 'Reciter'};
let mockTracks: unknown[] = [mockTrack];
let mockMushafListener: ((state: unknown) => void) | null = null;
let mockStoreListener: ((state: unknown) => void) | null = null;

function mockQueueState(tracks: unknown[]): unknown {
  return {queue: {tracks, currentIndex: 0}};
}

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => mockQueueState(mockTracks),
    subscribe: (fn: (state: unknown) => void) => {
      mockStoreListener = fn;
      return jest.fn();
    },
  },
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {
    subscribe: (fn: (state: unknown) => void) => {
      mockMushafListener = fn;
      return jest.fn();
    },
  },
}));
jest.mock('../ExpoAudioService', () => ({
  expoAudioService: {getPlayer: () => mockPlayer},
}));
jest.mock('../MushafAudioService', () => ({
  mushafAudioService: {getPlayer: () => null},
}));
jest.mock('../AudioCoordinator', () => ({audioCoordinator: {}}));

import {lockScreenService} from '../LockScreenService';

describe('LockScreenService car mode', () => {
  beforeEach(() => {
    lockScreenService.stopSync();
    lockScreenService.setCarMode(false);
    mockTracks = [mockTrack];
    mockSetActive.mockClear();
  });

  it('hides the skip buttons while a car is connected and restores them', () => {
    lockScreenService.setCarMode(true);
    expect(mockSetActive).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({title: 'Al-Fatihah'}),
      {showSeekForward: false, showSeekBackward: false},
    );
    lockScreenService.setCarMode(false);
    expect(mockSetActive).toHaveBeenLastCalledWith(true, expect.anything(), {
      showSeekForward: true,
      showSeekBackward: true,
    });
  });

  it('does nothing when the mode is unchanged', () => {
    lockScreenService.setCarMode(false);
    expect(mockSetActive).not.toHaveBeenCalled();
  });

  it('does not activate the player when there is no track', () => {
    mockTracks = [];
    lockScreenService.setCarMode(true);
    expect(mockSetActive).not.toHaveBeenCalled();
  });

  it('applies the flag to the next activation after a trackless toggle', async () => {
    mockTracks = [];
    lockScreenService.setCarMode(true);
    mockTracks = [mockTrack];
    await lockScreenService.startSync();
    expect(mockSetActive).toHaveBeenLastCalledWith(true, expect.anything(), {
      showSeekForward: false,
      showSeekBackward: false,
    });
  });

  it('does not re-activate the main player while mushaf is active', async () => {
    await lockScreenService.startSync();
    mockMushafListener?.({
      playbackState: 'playing',
      currentVerseKey: null,
      reciterName: '',
      currentSurah: 0,
    });
    mockSetActive.mockClear();
    lockScreenService.setCarMode(true);
    expect(mockSetActive).not.toHaveBeenCalled();
  });

  it('keeps the skip buttons off when a car request loads a new track', async () => {
    await lockScreenService.startSync();
    lockScreenService.setCarMode(true);
    mockSetActive.mockClear();
    const next = {id: 't2', title: 'Al-Baqarah', artist: 'Reciter'};
    mockTracks = [next];
    mockStoreListener?.(mockQueueState(mockTracks));
    expect(mockSetActive).toHaveBeenCalledTimes(1);
    expect(mockSetActive).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({title: 'Al-Baqarah'}),
      {showSeekForward: false, showSeekBackward: false},
    );
  });

  it('keeps the skip buttons off when the main player returns from mushaf', async () => {
    await lockScreenService.startSync();
    lockScreenService.setCarMode(true);
    const mushaf = {
      currentVerseKey: null,
      reciterName: '',
      currentSurah: 0,
    };
    mockMushafListener?.({...mushaf, playbackState: 'playing'});
    mockSetActive.mockClear();
    mockMushafListener?.({...mushaf, playbackState: 'idle'});
    expect(mockSetActive).toHaveBeenLastCalledWith(true, expect.anything(), {
      showSeekForward: false,
      showSeekBackward: false,
    });
  });
});
