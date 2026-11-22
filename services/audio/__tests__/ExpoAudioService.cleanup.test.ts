/**
 * @ai Regression tests: ExpoAudioService.cleanup() keeps the injected player.
 *
 * ExpoAudioProvider injects the runtime's single player only on mount.
 * cleanup() (called by playerStore.cleanup(), for example Settings -> Clear
 * cache) set the player to null, so every later loadTrack() threw
 * 'Player not set' until a restart, and LockScreenService had no player to
 * clear the lock-screen controls on.
 */

import type {AudioPlayer} from 'expo-audio';

jest.mock('expo-audio', () => ({setAudioModeAsync: jest.fn()}));

import {ExpoAudioService} from '../ExpoAudioService';

/** The slice of AudioPlayer that loadTrack() uses. */
class FakePlayer {
  isLoaded = false;
  replace = jest.fn(async (_source: {uri: string}) => {
    this.isLoaded = false;
    // The new source finishes loading on the next tick.
    setTimeout(() => {
      this.isLoaded = true;
    }, 0);
  });
}

function asPlayer(fake: Partial<AudioPlayer>): AudioPlayer {
  return fake as AudioPlayer;
}

describe('ExpoAudioService.cleanup()', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the injected player, so a load after the cleanup reaches it', async () => {
    const service = ExpoAudioService.getInstance();
    service.reset();
    const fake = new FakePlayer();
    const player = asPlayer(fake);
    service.setPlayer(player);

    service.cleanup();

    expect(service.getPlayer()).toBe(player);
    expect(service.hasPlayer()).toBe(true);
    await expect(
      service.loadTrack('https://cdn.example.com/next.mp3'),
    ).resolves.toBeUndefined();
    expect(fake.replace).toHaveBeenCalledWith({
      uri: 'https://cdn.example.com/next.mp3',
    });
    expect(service.getPlaybackState()).toBe('ready');
  });

  it('(safety) still resets the service state', () => {
    const service = ExpoAudioService.getInstance();
    service.reset();
    service.setPlayer(asPlayer(new FakePlayer()));

    service.cleanup();

    expect(service.getPlaybackState()).toBe('idle');
    expect(service.getCurrentUrl()).toBeNull();
    expect(service.getLastError()).toBeNull();
  });

  it('(safety) reset() drops the player for test isolation', () => {
    const service = ExpoAudioService.getInstance();
    service.setPlayer(asPlayer(new FakePlayer()));

    service.reset();

    expect(service.getPlayer()).toBeNull();
    expect(service.hasPlayer()).toBe(false);
  });
});
