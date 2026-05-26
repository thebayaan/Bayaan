/**
 * Characterization tests for ExpoAudioService — Group A from
 * bayaan-platform/planning/Characterization-Test-Plan.md.
 *
 * These tests lock in current state-machine behavior before any
 * AudioCoordinator / ExpoAudioProvider / LockScreenService refactor begins
 * (RFC-006 onward). They use a per-test `FakeAudioPlayer` that mirrors the
 * slice of expo-audio's AudioPlayer surface that ExpoAudioService.ts actually
 * touches. Once Group B reuses the same fake, it gets promoted into
 * @bayaan/test-utils.
 *
 * See docs/rfcs/005-audio-characterization-tests.md.
 */

// Mock setAudioModeAsync — the only native call ExpoAudioService.initialize()
// makes. The rest of the service flows through the injected FakeAudioPlayer.
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

import {setAudioModeAsync} from 'expo-audio';
import {ExpoAudioService} from '../ExpoAudioService';
import type {ExpoAudioServiceState} from '../ExpoAudioService';

/**
 * Test double for expo-audio's AudioPlayer. Exposes the slice of the surface
 * ExpoAudioService.ts uses (replace, play, pause, seekTo, setPlaybackRate,
 * volume, muted, currentTime, duration, playing, isLoaded, isBuffering,
 * playbackRate). Adds `simulate*` drivers for deterministic state changes.
 */
class FakeAudioPlayer {
  // expo-audio AudioPlayer surface (only what ExpoAudioService consumes)
  isLoaded = false;
  playing = false;
  isBuffering = false;
  currentTime = 0;
  duration = 0;
  playbackRate = 1;
  volume = 1;
  muted = false;

  replace = jest.fn(async (_source: {uri: string}) => {
    // Mimic expo-audio: replace() resets isLoaded then loads the new source.
    // Tests drive the loaded state via simulateLoaded().
    this.isLoaded = false;
    this.currentTime = 0;
    this.duration = 0;
  });

  play = jest.fn(async () => {
    this.playing = true;
  });

  pause = jest.fn(async () => {
    this.playing = false;
  });

  seekTo = jest.fn(async (positionSec: number) => {
    this.currentTime = positionSec;
  });

  setPlaybackRate = jest.fn(
    (rate: number, _quality: 'low' | 'medium' | 'high') => {
      this.playbackRate = rate;
    },
  );

  // Test driver: mark the player as loaded with a duration. Mirrors
  // expo-audio firing `playbackStatusUpdate { isLoaded: true }`.
  simulateLoaded(durationSec: number) {
    this.isLoaded = true;
    this.duration = durationSec;
  }
}

/**
 * Helper: instantiate the singleton, set a fake player, and return both.
 * `reset()` clears state between tests; the singleton itself can't be
 * re-newed cheaply, so reset+re-setup is the supported pattern (the service
 * exposes `reset()` for exactly this use case — see ExpoAudioService.ts:454).
 */
function makeService(): {service: ExpoAudioService; player: FakeAudioPlayer} {
  const service = ExpoAudioService.getInstance();
  service.reset();
  const player = new FakeAudioPlayer();
  service.setPlayer(player as unknown as Parameters<typeof service.setPlayer>[0]);
  return {service, player};
}

describe('ExpoAudioService — Group A characterization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------- A1 ---
  it('A1: initialize() is idempotent — second call no-ops', async () => {
    const {service} = makeService();

    await service.initialize();
    expect(service.getIsInitialized()).toBe(true);
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);

    await service.initialize();
    expect(service.getIsInitialized()).toBe(true);
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------- A2 ---
  it('A2: setPlayer() stores the player; calling twice replaces it', () => {
    const service = ExpoAudioService.getInstance();
    service.reset();

    const first = new FakeAudioPlayer();
    service.setPlayer(first as unknown as Parameters<typeof service.setPlayer>[0]);
    expect(service.getPlayer()).toBe(first);
    expect(service.hasPlayer()).toBe(true);

    const second = new FakeAudioPlayer();
    service.setPlayer(second as unknown as Parameters<typeof service.setPlayer>[0]);
    expect(service.getPlayer()).toBe(second);
    expect(service.getPlayer()).not.toBe(first);
  });

  // ---------------------------------------------------------------- A3 ---
  it('A3: loadTrack(url) happy path — state idle → loading → ready', async () => {
    const {service, player} = makeService();
    const states: ExpoAudioServiceState['playbackState'][] = [];
    service.addStateListener(s => states.push(s.playbackState));

    expect(service.getPlaybackState()).toBe('idle');

    // Simulate the player completing the load shortly after replace() is called.
    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      // Schedule the loaded transition so waitForLoaded() observes the
      // false→true edge. Microtask is enough since the poll uses setTimeout.
      setTimeout(() => player.simulateLoaded(60), 0);
    });

    await service.loadTrack('https://example.test/track.mp3');

    expect(service.getPlaybackState()).toBe('ready');
    expect(service.getCurrentUrl()).toBe('https://example.test/track.mp3');
    expect(player.replace).toHaveBeenCalledWith({uri: 'https://example.test/track.mp3'});
    // Listeners observed loading then ready (idle is the pre-listener baseline).
    expect(states).toContain('loading');
    expect(states[states.length - 1]).toBe('ready');
  });

  // ---------------------------------------------------------------- A4 ---
  it('A4: loadTrack(url) error — state error, lastError set, listeners notified', async () => {
    const {service, player} = makeService();
    const states: ExpoAudioServiceState['playbackState'][] = [];
    service.addStateListener(s => states.push(s.playbackState));

    const networkErr = new Error('network down');
    player.replace.mockRejectedValueOnce(networkErr);

    await expect(
      service.loadTrack('https://example.test/track.mp3'),
    ).rejects.toThrow('network down');

    expect(service.getPlaybackState()).toBe('error');
    expect(service.getLastError()).toBe(networkErr);
    expect(states[states.length - 1]).toBe('error');
  });

  // ---------------------------------------------------------------- A5 ---
  it('A5: play() from ready → playing; pause() from playing → paused', async () => {
    const {service, player} = makeService();

    // Manually drive into 'ready' state without going through loadTrack
    // (covered by A3) — direct test of play/pause transitions.
    player.simulateLoaded(60);
    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => player.simulateLoaded(60), 0);
    });
    await service.loadTrack('https://example.test/x.mp3');
    expect(service.getPlaybackState()).toBe('ready');

    await service.play();
    expect(service.getPlaybackState()).toBe('playing');
    expect(player.play).toHaveBeenCalledTimes(1);

    await service.pause();
    expect(service.getPlaybackState()).toBe('paused');
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------- A6 ---
  it('A6: seekTo(seconds) calls player.seekTo and does NOT change playback state', async () => {
    const {service, player} = makeService();

    // Get into 'playing'.
    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => player.simulateLoaded(60), 0);
    });
    await service.loadTrack('https://example.test/x.mp3');
    await service.play();
    expect(service.getPlaybackState()).toBe('playing');

    await service.seekTo(15);

    expect(player.seekTo).toHaveBeenCalledWith(15);
    expect(service.getPlaybackState()).toBe('playing'); // unchanged
  });

  // ---------------------------------------------------------------- A7 ---
  it('A7: setRate clamps to [0.5, 2.0] and calls player.setPlaybackRate(rate, "high")', () => {
    const {service, player} = makeService();

    service.setRate(1.25);
    expect(player.setPlaybackRate).toHaveBeenLastCalledWith(1.25, 'high');

    // Below clamp range — should clamp up to 0.5.
    service.setRate(0.1);
    expect(player.setPlaybackRate).toHaveBeenLastCalledWith(0.5, 'high');

    // Above clamp range — should clamp down to 2.0.
    service.setRate(5.0);
    expect(player.setPlaybackRate).toHaveBeenLastCalledWith(2.0, 'high');
  });

  // ---------------------------------------------------------------- A8 ---
  it('A8: state listeners receive correct state objects on each transition', async () => {
    const {service, player} = makeService();
    const observed: ExpoAudioServiceState[] = [];
    service.addStateListener(s => observed.push({...s}));

    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => player.simulateLoaded(60), 0);
    });
    await service.loadTrack('https://example.test/x.mp3');
    await service.play();

    // At minimum: loading, ready, playing — plus any intermediate notifications.
    const states = observed.map(s => s.playbackState);
    expect(states).toEqual(expect.arrayContaining(['loading', 'ready', 'playing']));

    // Every notification carries the full state shape.
    for (const s of observed) {
      expect(s).toHaveProperty('isInitialized');
      expect(s).toHaveProperty('playbackState');
      expect(s).toHaveProperty('error');
    }
  });

  // ---------------------------------------------------------------- A9 ---
  it('A9: listener unsubscribe stops further notifications', async () => {
    const {service, player} = makeService();
    const listener = jest.fn();
    const unsubscribe = service.addStateListener(listener);

    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => player.simulateLoaded(60), 0);
    });
    await service.loadTrack('https://example.test/x.mp3');
    expect(listener).toHaveBeenCalled();
    const callCountBeforeUnsubscribe = listener.mock.calls.length;

    unsubscribe();

    await service.play();
    await service.pause();

    expect(listener).toHaveBeenCalledTimes(callCountBeforeUnsubscribe);
  });
});
