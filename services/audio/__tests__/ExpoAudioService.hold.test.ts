// @ai-generated
/**
 * A pause asked for before the source has loaded must still hold when it
 * does. On iOS a source that replaces a playing one starts by itself as soon
 * as it is ready, whatever was asked in between: with a slow connection the
 * surah started seconds after it had been paused.
 *
 * Also what the app last asked for (wantsToPlay), which Android's status
 * cannot say while the player buffers after a seek.
 */

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

import {Platform} from 'react-native';
import {ExpoAudioService} from '../ExpoAudioService';

type Status = {
  isLoaded?: boolean;
  playing?: boolean;
  isBuffering?: boolean;
  didJustFinish?: boolean;
  error?: string | null;
};
type StatusListener = (status: Status) => void;

class FakeAudioPlayer {
  isLoaded = false;
  playing = false;
  isBuffering = false;
  currentTime = 0;
  duration = 0;
  playbackRate = 1;
  private listeners = new Set<StatusListener>();

  replace = jest.fn(async (_source: {uri: string}) => {
    this.isLoaded = false;
  });
  play = jest.fn(async () => {
    this.playing = true;
  });
  pause = jest.fn(async () => {
    this.playing = false;
  });
  seekTo = jest.fn(async (seconds: number) => {
    this.currentTime = seconds;
  });
  setPlaybackRate = jest.fn((rate: number) => {
    this.playbackRate = rate;
  });
  addListener = jest.fn((_event: string, listener: StatusListener) => {
    this.listeners.add(listener);
    return {remove: () => this.listeners.delete(listener)};
  });

  emit(status: Status): void {
    if (status.isLoaded !== undefined) this.isLoaded = status.isLoaded;
    this.listeners.forEach(listener => listener(status));
  }
}

const URL_B = 'https://cdn.example.com/b.mp3';

function makeService(): {service: ExpoAudioService; player: FakeAudioPlayer} {
  const service = ExpoAudioService.getInstance();
  service.reset();
  const player = new FakeAudioPlayer();
  service.setPlayer(
    player as unknown as Parameters<typeof service.setPlayer>[0],
  );
  return {service, player};
}

/** Starts a load that has not finished: the player holds an unloaded source. */
function startSlowLoad(service: ExpoAudioService): Promise<void> {
  const load = service.loadTrack(URL_B);
  load.catch(() => undefined);
  return load;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a pause before the source has loaded', () => {
  it('is repeated when the source starts by itself on becoming ready', async () => {
    const {service, player} = makeService();
    startSlowLoad(service);
    await Promise.resolve();
    await Promise.resolve();

    await service.pause();
    expect(player.pause).toHaveBeenCalledTimes(1);

    // Ready, and the player's own resume right behind it.
    player.emit({isLoaded: true, playing: false});
    player.emit({isLoaded: true, playing: true});
    expect(player.pause).toHaveBeenCalledTimes(2);
  });

  it('also when the resume is reported before the ready status', async () => {
    const {service, player} = makeService();
    startSlowLoad(service);
    await Promise.resolve();
    await Promise.resolve();
    await service.pause();

    player.emit({isLoaded: false, playing: true});
    expect(player.pause).toHaveBeenCalledTimes(2);
  });

  it('ends a moment after the source is ready: a later play is a request', async () => {
    const {service, player} = makeService();
    startSlowLoad(service);
    await Promise.resolve();
    await Promise.resolve();
    await service.pause();

    player.emit({isLoaded: true, playing: false});
    jest.advanceTimersByTime(1500);
    // Play from the lock screen or headphones, well after the load.
    player.emit({isLoaded: true, playing: true});
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('is dropped by play()', async () => {
    const {service, player} = makeService();
    startSlowLoad(service);
    await Promise.resolve();
    await Promise.resolve();
    await service.pause();

    await service.play();
    player.emit({isLoaded: true, playing: true});
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('does not carry over to another source', async () => {
    const {service, player} = makeService();
    startSlowLoad(service);
    await Promise.resolve();
    await Promise.resolve();
    await service.pause();

    const next = service.loadTrack('https://cdn.example.com/c.mp3');
    next.catch(() => undefined);
    await Promise.resolve();
    await Promise.resolve();
    player.emit({isLoaded: true, playing: true});
    expect(player.pause).toHaveBeenCalledTimes(1);
  });
});

describe('a pause on a loaded source', () => {
  it('holds nothing: a later play from outside is left alone', async () => {
    const {service, player} = makeService();
    startSlowLoad(service);
    await Promise.resolve();
    await Promise.resolve();
    player.emit({isLoaded: true, playing: false});

    await service.pause();
    player.emit({isLoaded: true, playing: true});
    expect(player.pause).toHaveBeenCalledTimes(1);
  });
});

// Android's isLoaded is false in a stall and at the end of a track as well,
// and its player keeps a pause through a load: nothing is held there. A play
// from the lock screen or headphones goes straight to the player, so a hold
// would undo it.
describe('Android: a pause on a source that had loaded', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  async function loadedAndPlaying(): Promise<{
    service: ExpoAudioService;
    player: FakeAudioPlayer;
  }> {
    const {service, player} = makeService();
    const load = service.loadTrack(URL_B);
    await Promise.resolve();
    await Promise.resolve();
    player.emit({isLoaded: true, playing: false, isBuffering: false});
    await load;
    await service.play();
    player.emit({isLoaded: true, playing: true, isBuffering: false});
    return {service, player};
  }

  it('in a stall: a play from the headphones is not paused again', async () => {
    const {service, player} = await loadedAndPlaying();
    // The stream stalls: not loaded, and still reported as playing.
    player.emit({isLoaded: false, playing: true, isBuffering: true});
    await service.pause();
    expect(player.pause).toHaveBeenCalledTimes(1);

    // Play on the headphones while it still buffers, then the data comes.
    player.emit({isLoaded: false, playing: true, isBuffering: true});
    player.emit({isLoaded: true, playing: true, isBuffering: false});
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('at the end of a track: a play from the lock screen is not paused again', async () => {
    const {service, player} = await loadedAndPlaying();
    player.emit({
      isLoaded: true,
      playing: false,
      isBuffering: false,
      didJustFinish: true,
    });
    // Ended: the player's isLoaded reads false there.
    player.isLoaded = false;
    await service.pause();
    expect(player.pause).toHaveBeenCalledTimes(1);

    // The lock screen starts the track again: it buffers, then plays.
    jest.advanceTimersByTime(60_000);
    player.emit({isLoaded: false, playing: false, isBuffering: true});
    player.emit({isLoaded: true, playing: true, isBuffering: false});
    expect(player.pause).toHaveBeenCalledTimes(1);
  });
});

describe('wantsToPlay()', () => {
  it('follows the last play or pause the app asked for', async () => {
    const {service} = makeService();
    expect(service.wantsToPlay()).toBe(false);
    await service.play();
    expect(service.wantsToPlay()).toBe(true);
    await service.pause();
    expect(service.wantsToPlay()).toBe(false);
    await service.play();
    service.cleanup();
    expect(service.wantsToPlay()).toBe(false);
  });

  // The notification, the lock screen, headphones, a call: the player
  // reports the stop, nothing in the app asked for it. Left at true, a seek
  // of the paused player on Android then showed it as buffering.
  it('follows a pause from outside the app', async () => {
    const {service, player} = makeService();
    await service.play();
    player.emit({isLoaded: true, playing: true, isBuffering: false});
    player.emit({isLoaded: true, playing: false, isBuffering: false});
    expect(service.wantsToPlay()).toBe(false);
  });

  it('follows a play from outside the app', async () => {
    const {service, player} = makeService();
    await service.pause();
    player.emit({isLoaded: true, playing: true, isBuffering: false});
    expect(service.wantsToPlay()).toBe(true);
  });

  // While Android's player buffers, `playing` is what it was before.
  it('keeps a pause asked for during a stall, which still reads as playing', async () => {
    const {service, player} = makeService();
    await service.play();
    player.emit({isLoaded: false, playing: true, isBuffering: true});
    await service.pause();
    player.emit({isLoaded: false, playing: true, isBuffering: true});
    expect(service.wantsToPlay()).toBe(false);
  });

  it('keeps a play asked for while the player buffers after a seek', async () => {
    const {service, player} = makeService();
    await service.play();
    player.emit({isLoaded: false, playing: false, isBuffering: true});
    expect(service.wantsToPlay()).toBe(true);
  });

  it('does not take the end of a track for a pause', async () => {
    const {service, player} = makeService();
    await service.play();
    player.emit({
      isLoaded: true,
      playing: false,
      isBuffering: false,
      didJustFinish: true,
    });
    expect(service.wantsToPlay()).toBe(true);
  });
});
