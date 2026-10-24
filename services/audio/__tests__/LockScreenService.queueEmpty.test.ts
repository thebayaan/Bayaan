/**
 * @ai Regression tests: the lock screen after Settings -> Clear cache.
 *
 * playerStore.cleanup() pauses the main player and empties the queue, so the
 * app shows no player. The main player's lock-screen and notification
 * controls stayed active, and a remote Play there resumed the old source.
 *
 * The contract these tests hold: when the main queue has no current track,
 * LockScreenService clears the main player's controls once. A track change
 * never clears them, and the Mushaf player is never cleared by this path.
 *
 * These tests use the REAL playerStore and the REAL LockScreenService, so the
 * queue writes have their real shapes. The native players are fakes.
 */

const mockMainPlayer = {
  setActiveForLockScreen: jest.fn(),
  clearLockScreenControls: jest.fn(),
};

const mockMushafPlayer = {
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    getPlayer: () => mockMainPlayer,
    loadTrack: jest.fn(() => Promise.resolve()),
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(() => Promise.resolve()),
    seekTo: jest.fn(() => Promise.resolve()),
    getDuration: jest.fn(() => 120),
    getIsLoaded: jest.fn(() => true),
    getCurrentTime: jest.fn(() => 0),
    getIsPlaying: jest.fn(() => false),
    setRate: jest.fn(),
    cleanup: jest.fn(),
  },
}));

jest.mock('@/services/audio/MushafAudioService', () => ({
  mushafAudioService: {getPlayer: () => mockMushafPlayer},
}));

jest.mock('@/store/mushafPlayerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useMushafPlayerStore: create(() => ({
      playbackState: 'idle',
      currentSurah: 0,
      currentVerseKey: null,
      currentVerseLabel: null,
      numberingMode: null,
      reciterName: 'Test Reciter',
    })),
  };
});

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

import {lockScreenService} from '../LockScreenService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  useMushafPlayerStore,
  type MushafPlayerStoreState,
} from '@/store/mushafPlayerStore';
import type {Track} from '@/types/audio';

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

const setMushaf = (state: Partial<MushafPlayerStoreState>) =>
  useMushafPlayerStore.setState(state);

/** The titles that the main player got on the lock screen, in order. */
const activatedTitles = (): string[] =>
  mockMainPlayer.setActiveForLockScreen.mock.calls.map(
    ([, metadata]) => metadata.title,
  );

// Let awaited continuations run to completion.
const flush = () => new Promise<void>(r => setTimeout(r, 0));

describe('LockScreenService: the main queue has no current track', () => {
  beforeEach(async () => {
    usePlayerStore.getState().reset();
    setMushaf({playbackState: 'idle'});
    await lockScreenService.startSync();
    jest.clearAllMocks();
  });

  afterEach(() => {
    lockScreenService.stopSync();
  });

  it('(safety) a track change does not clear the controls', async () => {
    const store = usePlayerStore.getState();
    await store.updateQueue([makeTrack('a'), makeTrack('b')], 0);
    await flush();
    await usePlayerStore.getState().skipToNext();
    await flush();
    // A new queue replaces the old one.
    await usePlayerStore
      .getState()
      .updateQueue([makeTrack('c'), makeTrack('d'), makeTrack('e')], 0);
    await flush();
    await usePlayerStore.getState().addToQueue([makeTrack('f')]);
    await usePlayerStore.getState().moveInQueue(3, 1);
    // Remove another track, then the current one (the next track loads).
    await usePlayerStore.getState().removeFromQueue([2]);
    await usePlayerStore.getState().removeFromQueue([0]);
    await flush();

    expect(mockMainPlayer.clearLockScreenControls).not.toHaveBeenCalled();
    expect(mockMushafPlayer.clearLockScreenControls).not.toHaveBeenCalled();
    expect(activatedTitles()).toEqual([
      'Track a',
      'Track b',
      'Track c',
      'Track f',
    ]);
  });

  it('cleanup() clears the main controls once, and the next play shows them again', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    await flush();
    expect(activatedTitles()).toEqual(['Track a']);

    await usePlayerStore.getState().cleanup();
    expect(mockMainPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);

    // Later writes on the empty queue (the provider's status sync) do not
    // clear again.
    usePlayerStore.getState().updatePlaybackState({state: 'paused'});
    usePlayerStore.getState().updatePlaybackState({position: 12});
    expect(mockMainPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
    expect(mockMushafPlayer.clearLockScreenControls).not.toHaveBeenCalled();

    // The same track again: the controls come back.
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    await flush();
    expect(activatedTitles()).toEqual(['Track a', 'Track a']);
    expect(mockMainPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
  });

  it('(safety) an empty queue at the start clears nothing', () => {
    usePlayerStore.getState().updatePlaybackState({state: 'paused'});
    expect(mockMainPlayer.clearLockScreenControls).not.toHaveBeenCalled();
  });

  it('while the Mushaf plays, cleanup() clears neither player; the main controls clear when the Mushaf goes idle', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    await flush();
    setMushaf({playbackState: 'playing'});

    await usePlayerStore.getState().cleanup();
    expect(mockMainPlayer.clearLockScreenControls).not.toHaveBeenCalled();
    expect(mockMushafPlayer.clearLockScreenControls).not.toHaveBeenCalled();

    // The Mushaf stops. Its own controls clear (existing behaviour), and the
    // main player has no track to show, so its controls clear too.
    setMushaf({playbackState: 'idle'});
    expect(mockMushafPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
    expect(mockMainPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
    expect(activatedTitles()).toEqual(['Track a']);
  });

  it('(safety) the Mushaf goes idle with a main track in the queue: the main controls come back, nothing clears them', async () => {
    await usePlayerStore.getState().updateQueue([makeTrack('a')], 0);
    await flush();
    setMushaf({playbackState: 'playing'});
    setMushaf({playbackState: 'idle'});

    expect(mockMainPlayer.clearLockScreenControls).not.toHaveBeenCalled();
    expect(activatedTitles()).toEqual(['Track a', 'Track a']);
  });
});
