import type {AudioPlayer} from 'expo-audio';

jest.mock('expo-audio', () => ({setAudioModeAsync: jest.fn()}));

import {ExpoAudioService} from '../ExpoAudioService';

// The service is a singleton holding the player; these tests never set one
// before they check the waiting path, so they run on a fresh module each.
function freshService(): ExpoAudioService {
  let service: ExpoAudioService | null = null;
  jest.isolateModules(() => {
    const mod: typeof import('../ExpoAudioService') = require('../ExpoAudioService');
    service = mod.expoAudioService;
  });
  if (!service) throw new Error('service failed to load');
  return service;
}

function fakePlayer(): AudioPlayer {
  const player: Partial<AudioPlayer> = {};
  return player as AudioPlayer;
}

describe('ExpoAudioService.waitForPlayer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves as soon as a player is set', async () => {
    const service = freshService();
    const done = jest.fn();
    service.waitForPlayer(10_000).then(done);
    await jest.advanceTimersByTimeAsync(5_000);
    expect(done).not.toHaveBeenCalled();
    service.setPlayer(fakePlayer());
    await jest.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('resolves at once when a player is already set', async () => {
    const service = freshService();
    service.setPlayer(fakePlayer());
    const done = jest.fn();
    service.waitForPlayer(10_000).then(done);
    await jest.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('gives up after the timeout', async () => {
    const service = freshService();
    const done = jest.fn();
    service.waitForPlayer(10_000).then(done);
    await jest.advanceTimersByTimeAsync(9_999);
    expect(done).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
