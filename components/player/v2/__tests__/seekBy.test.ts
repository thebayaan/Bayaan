// @ai-generated
// The back / forward 15 seconds buttons. They used to add 15 to the store's
// position, which is refreshed once a second on iOS and every two on Android.

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    isSourceReady: jest.fn(),
    getIsLoaded: jest.fn(),
    getCurrentTime: jest.fn(),
    getDuration: jest.fn(),
  },
}));
jest.mock('@/services/player/store/playerStore', () => {
  const state = {
    playback: {position: 0, duration: 600},
    queue: {tracks: [{url: 'https://cdn.example.com/2.mp3'}], currentIndex: 0},
    seekTo: jest.fn(),
  };
  return {
    usePlayerStore: {getState: () => state},
    // The real check: the player holds the current track, loaded.
    isCurrentTrackLoaded: () => {
      const {expoAudioService: audio} = jest.requireMock(
        '@/services/audio/ExpoAudioService',
      );
      const url = state.queue.tracks[state.queue.currentIndex]?.url;
      return !!url && audio.isSourceReady(url) && audio.getIsLoaded();
    },
  };
});

import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {seekBy} from '../seekBy';

const mockAudio = jest.mocked(expoAudioService);
const mockSeekTo = jest.mocked(usePlayerStore.getState().seekTo);

/** What the store last saved (its position is refreshed every second or two). */
function setSaved(position: number, duration = 600): void {
  Object.assign(usePlayerStore.getState().playback, {position, duration});
}

/** A seek that stays in flight until `land()` is called. */
function seekInFlight(): () => void {
  let land!: () => void;
  mockSeekTo.mockImplementationOnce(
    () => new Promise<void>(resolve => (land = resolve)),
  );
  return () => land();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSeekTo.mockResolvedValue(undefined);
  mockAudio.isSourceReady.mockReturnValue(true);
  mockAudio.getIsLoaded.mockReturnValue(true);
  mockAudio.getCurrentTime.mockReturnValue(0);
  mockAudio.getDuration.mockReturnValue(600);
  setSaved(0);
});

describe('seekBy', () => {
  it("jumps from the player's clock, not the store's older position", async () => {
    setSaved(100); // last refresh, two seconds ago
    mockAudio.getCurrentTime.mockReturnValue(102);

    await seekBy(15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(117);

    await seekBy(-15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(87);
  });

  it('adds up two quick taps while the first seek is in flight', async () => {
    mockAudio.getCurrentTime.mockReturnValue(100); // iOS: unchanged mid-seek
    const landFirst = seekInFlight();
    const landSecond = seekInFlight();

    const first = seekBy(15);
    const second = seekBy(15);
    expect(mockSeekTo.mock.calls).toEqual([[115], [130]]);

    // The first seek reports back (cancelled by the second): the second
    // one's target still stands for a third tap.
    landFirst();
    await first;
    const third = seekBy(-15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(115);

    landSecond();
    await Promise.all([second, third]);
  });

  it("goes back to the player's clock once the seek has landed", async () => {
    mockAudio.getCurrentTime.mockReturnValue(100);
    await seekBy(15);
    mockAudio.getCurrentTime.mockReturnValue(140); // played on since
    await seekBy(15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(155);
  });

  it('forgets a seek that never reports back', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    mockAudio.getCurrentTime.mockReturnValue(100);
    const land = seekInFlight();
    const stuck = seekBy(15);

    now.mockReturnValue(1_000_000 + 5000);
    mockAudio.getCurrentTime.mockReturnValue(200);
    await seekBy(15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(215);

    land();
    await stuck;
    now.mockRestore();
  });

  it('stays inside the track', async () => {
    mockAudio.getCurrentTime.mockReturnValue(5);
    await seekBy(-15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(0);

    mockAudio.getCurrentTime.mockReturnValue(595);
    await seekBy(15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(600);
  });

  it('does not cap a jump forward while the duration is unknown', async () => {
    mockAudio.getDuration.mockReturnValue(0);
    mockAudio.getCurrentTime.mockReturnValue(50);
    await seekBy(15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(65);
  });

  // After a launch whose restore could not load the track, the player has
  // nothing to ask (its clock reads 0) and the store holds the saved place.
  it('jumps from the saved position when the player has nothing loaded', async () => {
    setSaved(754, 2400);
    mockAudio.getCurrentTime.mockReturnValue(0);
    mockAudio.getDuration.mockReturnValue(0);

    mockAudio.isSourceReady.mockReturnValue(false);
    await seekBy(15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(769);

    mockAudio.isSourceReady.mockReturnValue(true);
    mockAudio.getIsLoaded.mockReturnValue(false);
    await seekBy(-15);
    expect(mockSeekTo).toHaveBeenLastCalledWith(739);
  });
});
