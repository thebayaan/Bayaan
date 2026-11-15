// Quran audio must never play into the microphone: when Bayaan's own
// playback starts, any recitation session (follow-along or identify) stops.

const mockSession = {purpose: null as string | null};
const mockStopSession = jest.fn(async () => undefined);

jest.mock('@/services/recitation/activeSession', () => ({
  activeSessionPurpose: () => mockSession.purpose,
}));
jest.mock('@/services/recitation/sessionRunner', () => ({
  stopSession: mockStopSession,
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({playback: {state: 'paused'}, pause: jest.fn()}),
  },
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {
    getState: () => ({playbackState: 'idle', setPlaybackState: jest.fn()}),
  },
}));
jest.mock('../MushafAudioService', () => ({
  mushafAudioService: {pause: jest.fn(), getIsPlaying: () => false},
}));

function freshCoordinator(): typeof import('../AudioCoordinator').audioCoordinator {
  let instance!: typeof import('../AudioCoordinator').audioCoordinator;
  jest.isolateModules(() => {
    instance = require('../AudioCoordinator').audioCoordinator;
  });
  return instance;
}

beforeEach(() => {
  mockSession.purpose = null;
  mockStopSession.mockClear();
});

describe('AudioCoordinator and recitation sessions', () => {
  it('main playback stops an identify session', () => {
    mockSession.purpose = 'identify';
    freshCoordinator().mainWillPlay();
    expect(mockStopSession).toHaveBeenCalledWith('playback_started');
  });

  it('mushaf playback stops a follow-along session', () => {
    mockSession.purpose = 'follow';
    freshCoordinator().mushafWillPlay();
    expect(mockStopSession).toHaveBeenCalledWith('playback_started');
  });

  it('nothing is stopped when no session runs', () => {
    freshCoordinator().mainWillPlay();
    expect(mockStopSession).not.toHaveBeenCalled();
  });
});
