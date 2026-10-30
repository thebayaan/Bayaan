/**
 * @ai Regression tests: removeFromQueue() supersedes an in-flight load
 * (follow-up to the review of #315).
 *
 * The bug: skipToNext() writes trackLoading: true and state 'loading', then
 * awaits the network. A removeFromQueue() of the current track in that window
 * starts its own load, so the skip is superseded (playOpId) and returns before
 * its trailing set(). removeFromQueue() never cleared either flag, so:
 *
 * - trackLoading stayed true, and the full-player controls stayed disabled;
 * - the state stayed 'loading', and ExpoAudioProvider skips its status sync in
 *   that state, so nothing corrected it;
 * - the autoplay check read 'loading', not 'playing', so the replacement track
 *   loaded paused.
 *
 * The contract these tests hold: the winning op clears all loading state, and
 * the autoplay intent comes from before the reload.
 */

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    loadTrack: jest.fn(),
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(() => Promise.resolve()),
    seekTo: jest.fn(() => Promise.resolve()),
    getDuration: jest.fn(() => 120),
    getIsLoaded: jest.fn(() => true),
    getCurrentTime: jest.fn(() => 0),
    getPosition: jest.fn(() => 0),
    getIsPlaying: jest.fn(() => false),
    setRate: jest.fn(),
    cleanup: jest.fn(),
  },
}));

jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {
    mainWillPlay: jest.fn(),
  },
}));

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackPlaybackSkipped: jest.fn(),
    trackPlaybackSeeked: jest.fn(),
    trackRateChanged: jest.fn(),
  },
}));

import {usePlayerStore} from '../playerStore';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import type {Track} from '@/types/audio';

const mockedAudio = jest.mocked(expoAudioService);

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return {promise, resolve};
}

function makeTrack(id: string): Track {
  return {
    id,
    url: `https://cdn.example.com/${id}.mp3`,
    title: `Track ${id}`,
    artist: 'Test Reciter',
    reciterId: 'test-reciter',
    reciterName: 'Test Reciter',
    surahId: '1',
  };
}

const urlOf = (id: string): string => `https://cdn.example.com/${id}.mp3`;

// Let awaited continuations run to completion.
const flush = () => new Promise<void>(r => setTimeout(r, 0));

/**
 * A queue of a, b, c on `currentIndex`, loaded, in `playbackState`. The
 * provider writes 'playing' or 'paused' in the app; the test writes it here.
 */
async function startQueue(
  currentIndex: number,
  playbackState: 'playing' | 'paused',
): Promise<void> {
  await usePlayerStore
    .getState()
    .updateQueue(
      [makeTrack('a'), makeTrack('b'), makeTrack('c')],
      currentIndex,
    );
  await flush();
  usePlayerStore.getState().updatePlaybackState({state: playbackState});
  jest.clearAllMocks();
}

describe('removeFromQueue() clears the loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePlayerStore.getState().reset();
    mockedAudio.loadTrack.mockImplementation(() => Promise.resolve());
  });

  it('skipToNext in flight, then remove the current track: loading ends, the state is playing, the replacement autoplays', async () => {
    await startQueue(0, 'playing');
    const skipLoad = deferred();
    mockedAudio.loadTrack.mockImplementationOnce(() => skipLoad.promise);

    // The skip parks on the network with trackLoading true, state 'loading'.
    const skip = usePlayerStore.getState().skipToNext();
    await flush();
    expect(usePlayerStore.getState().queue.currentIndex).toBe(1);
    expect(usePlayerStore.getState().loading.trackLoading).toBe(true);
    expect(usePlayerStore.getState().playback.state).toBe('loading');

    // The user removes the track that the skip loads (b).
    await usePlayerStore.getState().removeFromQueue([1]);

    // The superseded skip's network load ends later.
    skipLoad.resolve();
    await skip;
    await flush();

    expect(mockedAudio.loadTrack).toHaveBeenLastCalledWith(urlOf('c'));
    // One play(): the replacement's. The superseded skip did not play b.
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.queue.tracks.map(t => t.id)).toEqual(['a', 'c']);
    expect(state.queue.currentIndex).toBe(1);
    expect(state.loading.trackLoading).toBe(false);
    expect(state.loading.queueLoading).toBe(false);
    expect(state.playback.state).not.toBe('loading');
    expect(state.playback.state).toBe('playing');
  });

  it('the same race when the skip load ends during the replacement load', async () => {
    await startQueue(0, 'playing');
    const skipLoad = deferred();
    const removeLoad = deferred();
    mockedAudio.loadTrack
      .mockImplementationOnce(() => skipLoad.promise)
      .mockImplementationOnce(() => removeLoad.promise);

    const skip = usePlayerStore.getState().skipToNext();
    await flush();
    const remove = usePlayerStore.getState().removeFromQueue([1]);
    await flush();

    skipLoad.resolve();
    await skip;
    await flush();
    // The superseded skip wrote nothing and did not play.
    expect(mockedAudio.play).not.toHaveBeenCalled();

    removeLoad.resolve();
    await remove;
    await flush();

    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.loading.trackLoading).toBe(false);
    expect(state.playback.state).toBe('playing');
  });

  it('the replacement load fails during a skip: loading still ends, the error is recorded', async () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      await startQueue(0, 'playing');
      const skipLoad = deferred();
      const loadError = new Error('network down');
      mockedAudio.loadTrack
        .mockImplementationOnce(() => skipLoad.promise)
        .mockImplementationOnce(() => Promise.reject(loadError));

      const skip = usePlayerStore.getState().skipToNext();
      await flush();
      await usePlayerStore.getState().removeFromQueue([1]);
      skipLoad.resolve();
      await skip;
      await flush();

      const state = usePlayerStore.getState();
      expect(state.error.queue).toBe(loadError);
      expect(state.loading.trackLoading).toBe(false);
      expect(state.loading.queueLoading).toBe(false);
      expect(mockedAudio.play).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('a paused queue stays paused: remove the current track -> the replacement loads with no play() and the state is ready', async () => {
    await startQueue(1, 'paused');

    await usePlayerStore.getState().removeFromQueue([1]);
    await flush();

    expect(mockedAudio.loadTrack).toHaveBeenCalledWith(urlOf('c'));
    expect(mockedAudio.play).not.toHaveBeenCalled();
    const state = usePlayerStore.getState();
    expect(state.queue.tracks.map(t => t.id)).toEqual(['a', 'c']);
    expect(state.queue.currentIndex).toBe(1);
    expect(state.loading.trackLoading).toBe(false);
    // The reload wrote its own settled state: loaded, not playing.
    expect(state.playback.state).toBe('ready');
  });

  // Safety tests: they pass on the unfixed code too.
  it('(safety) a playing queue with no load in flight: the replacement autoplays and the state is playing', async () => {
    await startQueue(1, 'playing');

    await usePlayerStore.getState().removeFromQueue([1]);
    await flush();

    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.loading.trackLoading).toBe(false);
    expect(state.playback.state).toBe('playing');
  });

  it('(safety) removing another track during a skip leaves the loading state to the skip', async () => {
    await startQueue(0, 'playing');
    const skipLoad = deferred();
    mockedAudio.loadTrack.mockImplementationOnce(() => skipLoad.promise);

    const skip = usePlayerStore.getState().skipToNext();
    await flush();

    // Remove c, not the current track: no reload, so the skip still owns
    // the loading state.
    await usePlayerStore.getState().removeFromQueue([2]);
    expect(usePlayerStore.getState().loading.trackLoading).toBe(true);
    expect(usePlayerStore.getState().playback.state).toBe('loading');

    skipLoad.resolve();
    await skip;
    await flush();

    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.queue.tracks.map(t => t.id)).toEqual(['a', 'b']);
    expect(state.loading.trackLoading).toBe(false);
    expect(state.playback.state).toBe('playing');
  });

  it('(safety) a superseded removeFromQueue skips its trailing write: a newer queue stands', async () => {
    await startQueue(1, 'playing');
    const removeLoad = deferred();
    mockedAudio.loadTrack.mockImplementationOnce(() => removeLoad.promise);

    const remove = usePlayerStore.getState().removeFromQueue([1]);
    await flush();
    await usePlayerStore.getState().updateQueue([makeTrack('x')], 0);
    await flush();

    removeLoad.resolve();
    await remove;
    await flush();

    // Only the newer load played; the stale reload of c did not.
    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.queue.tracks.map(t => t.id)).toEqual(['x']);
    expect(state.queue.currentIndex).toBe(0);
    expect(state.loading.trackLoading).toBe(false);
  });
});

/**
 * @ai A removal that leaves the queue with no current track pauses first.
 * The queue view shows a remove control on every row, the current one too.
 * Before, a removal of the only track loaded nothing and paused nothing, and
 * the state stayed 'playing'. The app then showed no player, so the audio
 * had no control in the app.
 */
describe('removeFromQueue() that leaves no current track', () => {
  /** The queue length at each pause() call. */
  let queueLengthAtPause: number[];

  beforeEach(() => {
    jest.clearAllMocks();
    usePlayerStore.getState().reset();
    mockedAudio.loadTrack.mockImplementation(() => Promise.resolve());
    queueLengthAtPause = [];
    mockedAudio.pause.mockImplementation(() => {
      queueLengthAtPause.push(usePlayerStore.getState().queue.tracks.length);
      return Promise.resolve();
    });
  });

  async function playOnly(ids: string[], currentIndex = 0): Promise<void> {
    await usePlayerStore
      .getState()
      .updateQueue(ids.map(makeTrack), currentIndex);
    await flush();
    usePlayerStore.getState().updatePlaybackState({state: 'playing'});
    jest.clearAllMocks();
    queueLengthAtPause = [];
  }

  it('remove the only track while it plays: pause() runs before the queue is empty; the state is paused', async () => {
    await playOnly(['a']);

    await usePlayerStore.getState().removeFromQueue([0]);

    expect(mockedAudio.pause).toHaveBeenCalledTimes(1);
    expect(queueLengthAtPause).toEqual([1]);
    expect(mockedAudio.loadTrack).not.toHaveBeenCalled();
    expect(mockedAudio.play).not.toHaveBeenCalled();
    const state = usePlayerStore.getState();
    expect(state.queue.tracks).toHaveLength(0);
    expect(state.playback.state).toBe('paused');
    expect(state.loading.trackLoading).toBe(false);
    expect(state.loading.queueLoading).toBe(false);
  });

  it('remove the last tracks together while they play: pause() runs before the queue is empty', async () => {
    await playOnly(['a', 'b']);

    await usePlayerStore.getState().removeFromQueue([0, 1]);

    expect(queueLengthAtPause).toEqual([2]);
    expect(mockedAudio.play).not.toHaveBeenCalled();
    const state = usePlayerStore.getState();
    expect(state.queue.tracks).toHaveLength(0);
    expect(state.playback.state).toBe('paused');
    expect(state.loading.trackLoading).toBe(false);
  });

  it('a skip in flight, then remove every track: the skip starts no audio, the state is paused', async () => {
    await playOnly(['a', 'b'], 1);
    const skipLoad = deferred();
    mockedAudio.loadTrack.mockImplementationOnce(() => skipLoad.promise);

    // skipToPrevious parks on the network: index 0, state 'loading'.
    const skip = usePlayerStore.getState().skipToPrevious();
    await flush();
    expect(usePlayerStore.getState().playback.state).toBe('loading');

    await usePlayerStore.getState().removeFromQueue([0, 1]);
    skipLoad.resolve();
    await skip;
    await flush();

    expect(mockedAudio.pause).toHaveBeenCalledTimes(1);
    expect(mockedAudio.play).not.toHaveBeenCalled();
    const state = usePlayerStore.getState();
    expect(state.queue.tracks).toHaveLength(0);
    expect(state.playback.state).toBe('paused');
    expect(state.loading.trackLoading).toBe(false);
  });

  it('(safety) a newer queue during the pause wins: the removal writes nothing after the pause', async () => {
    await playOnly(['a']);
    const pause = deferred();
    mockedAudio.pause.mockImplementationOnce(() => pause.promise);

    const remove = usePlayerStore.getState().removeFromQueue([0]);
    await flush();
    await usePlayerStore.getState().updateQueue([makeTrack('x')], 0);
    await flush();
    pause.resolve();
    await remove;
    await flush();

    expect(mockedAudio.play).toHaveBeenCalledTimes(1);
    const state = usePlayerStore.getState();
    expect(state.queue.tracks.map(t => t.id)).toEqual(['x']);
    expect(state.playback.state).toBe('ready');
  });
});
