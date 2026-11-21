// @ai-generated
/**
 * loadTrack() in the Android background (#540). There Android runs no JS
 * timers, but the player's status updates still reach JS. The wait for the
 * new source must end on those updates, or the track end handler that called
 * it stays busy, and the next track end advances nothing.
 */
import type {AudioPlayer} from 'expo-audio';

jest.mock('expo-audio', () => ({setAudioModeAsync: jest.fn()}));

import {ExpoAudioService} from '../ExpoAudioService';

/** The fields of a playbackStatusUpdate that the service reads. */
interface Status {
  isLoaded: boolean;
  playing: boolean;
  isBuffering: boolean;
  didJustFinish: boolean;
}
type Listener = (status: Status) => void;

/** The slice of AudioPlayer that loadTrack() uses, as on Android. */
class FakePlayer {
  // A player at the end of a track counts as loaded on Android.
  isLoaded = true;
  private listeners = new Set<Listener>();
  replace = jest.fn((_source: {uri: string}) => undefined);
  addListener = jest.fn((_event: string, listener: Listener) => {
    this.listeners.add(listener);
    return {remove: () => this.listeners.delete(listener)};
  });

  /** A native playbackStatusUpdate. */
  status(isLoaded: boolean): void {
    this.isLoaded = isLoaded;
    const update: Status = {
      isLoaded,
      playing: false,
      isBuffering: false,
      didJustFinish: false,
    };
    this.listeners.forEach(listener => listener(update));
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

function makeService(): {service: ExpoAudioService; player: FakePlayer} {
  const service = ExpoAudioService.getInstance();
  service.reset();
  const player = new FakePlayer();
  service.setPlayer(player as unknown as AudioPlayer);
  return {service, player};
}

/** Lets pending promise callbacks run. No timer runs. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('ExpoAudioService.loadTrack while no JS timer runs', () => {
  // Fake timers that the tests never advance: the Android background.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('ends when the status updates report the new source loaded', async () => {
    const {service, player} = makeService();
    // The service's own status listener (errors, outside plays) stays.
    const ownListeners = player.listenerCount();
    const done = jest.fn();
    service.loadTrack('https://example.test/next.mp3').then(done);
    await flush();
    expect(player.replace).toHaveBeenCalledWith({
      uri: 'https://example.test/next.mp3',
    });

    // The new source starts to load, then is ready.
    player.status(false);
    await flush();
    expect(done).not.toHaveBeenCalled();
    player.status(true);
    await flush();

    expect(done).toHaveBeenCalledTimes(1);
    expect(service.getPlaybackState()).toBe('ready');
    expect(service.getCurrentUrl()).toBe('https://example.test/next.mp3');
    expect(player.listenerCount()).toBe(ownListeners);
  });

  it('still ends on the timer in the foreground', async () => {
    const {service, player} = makeService();
    const ownListeners = player.listenerCount();
    const done = jest.fn();
    service.loadTrack('https://example.test/next.mp3').then(done);
    await flush();
    player.isLoaded = false;
    await jest.advanceTimersByTimeAsync(100);
    expect(done).not.toHaveBeenCalled();
    player.isLoaded = true;
    await jest.advanceTimersByTimeAsync(50);

    expect(done).toHaveBeenCalledTimes(1);
    expect(player.listenerCount()).toBe(ownListeners);
  });
});
