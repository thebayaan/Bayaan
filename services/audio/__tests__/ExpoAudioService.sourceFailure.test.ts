// @ai-generated
/**
 * A source that cannot be loaded (offline, a dead link, a missing file) is
 * reported by expo-audio as an `error` string on a status update. The
 * service used to wait out its 5 s load timeout and carry on as if the track
 * were ready, which ended in a play() that made no sound.
 */

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

import {ExpoAudioService} from '../ExpoAudioService';

type StatusListener = (status: {error?: string | null}) => void;

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

  emit(status: {error?: string | null}): void {
    this.listeners.forEach(listener => listener(status));
  }
}

function makeService(): {service: ExpoAudioService; player: FakeAudioPlayer} {
  const service = ExpoAudioService.getInstance();
  service.reset();
  const player = new FakeAudioPlayer();
  service.setPlayer(
    player as unknown as Parameters<typeof service.setPlayer>[0],
  );
  return {service, player};
}

const URL_A = 'https://example.test/a.mp3';
const URL_B = 'https://example.test/b.mp3';

describe('ExpoAudioService: a source that fails', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loadTrack() rejects as soon as the player reports the failure', async () => {
    const {service, player} = makeService();
    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(
        () =>
          player.emit({
            error: 'The Internet connection appears to be offline.',
          }),
        10,
      );
    });

    const started = Date.now();
    await expect(service.loadTrack(URL_A)).rejects.toThrow(/offline/);

    // Well under the 5 s it used to wait before carrying on regardless.
    expect(Date.now() - started).toBeLessThan(2000);
    expect(service.getPlaybackState()).toBe('error');
    expect(service.isSourceReady(URL_A)).toBe(false);
  });

  it('a loaded source is ready; another url is not', async () => {
    const {service, player} = makeService();
    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => {
        player.isLoaded = true;
        player.duration = 60;
      }, 0);
    });

    await service.loadTrack(URL_A);

    expect(service.isSourceReady(URL_A)).toBe(true);
    expect(service.isSourceReady(URL_B)).toBe(false);
  });

  it('a stream that breaks after loading is no longer ready', async () => {
    const {service, player} = makeService();
    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => {
        player.isLoaded = true;
      }, 0);
    });
    await service.loadTrack(URL_A);

    player.emit({error: 'The network connection was lost.'});

    expect(service.isSourceReady(URL_A)).toBe(false);
  });

  it('the next load starts clean after a failure', async () => {
    const {service, player} = makeService();
    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => player.emit({error: 'dead link'}), 0);
    });
    await expect(service.loadTrack(URL_A)).rejects.toThrow('dead link');

    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => {
        player.isLoaded = true;
      }, 0);
    });
    await service.loadTrack(URL_B);

    expect(service.isSourceReady(URL_B)).toBe(true);
    expect(service.getPlaybackState()).toBe('ready');
  });

  it('nothing is ready before a load, or after cleanup()', async () => {
    const {service, player} = makeService();
    expect(service.isSourceReady(URL_A)).toBe(false);

    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => {
        player.isLoaded = true;
      }, 0);
    });
    await service.loadTrack(URL_A);
    service.cleanup();

    expect(service.isSourceReady(URL_A)).toBe(false);
  });

  it('loadTrack() waits for the player on a cold start instead of throwing', async () => {
    const service = ExpoAudioService.getInstance();
    service.reset();
    const player = new FakeAudioPlayer();
    player.replace.mockImplementationOnce(async () => {
      player.isLoaded = false;
      setTimeout(() => {
        player.isLoaded = true;
      }, 0);
    });

    const loading = service.loadTrack(URL_A);
    // The provider hands the player over a moment later.
    setTimeout(
      () =>
        service.setPlayer(
          player as unknown as Parameters<typeof service.setPlayer>[0],
        ),
      20,
    );
    await loading;

    expect(player.replace).toHaveBeenCalledWith({uri: URL_A});
    expect(service.isSourceReady(URL_A)).toBe(true);
  });
});
