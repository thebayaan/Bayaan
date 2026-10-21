// @ai-start
jest.mock('expo-audio', () => {
  const players: unknown[] = [];
  return {
    __players: players,
    createAudioPlayer: jest.fn(() => {
      const listeners: ((status: unknown) => void)[] = [];
      const player = {
        url: null as string | null,
        replace: jest.fn((source: {uri: string}) => {
          player.url = source.uri;
        }),
        seekTo: jest.fn(() => Promise.resolve()),
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        setPlaybackRate: jest.fn(),
        addListener: jest.fn((_: string, l: (status: unknown) => void) => {
          listeners.push(l);
          return {remove: jest.fn()};
        }),
        emit: (status: unknown) => listeners.forEach(l => l(status)),
      };
      players.push(player);
      return player;
    }),
  };
});

jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {momentsWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));

import * as ExpoAudio from 'expo-audio';
import {momentsAudioService} from '../MomentsAudioService';
import {momentSourceFor} from '../momentSource';

interface MockPlayer {
  url: string | null;
  seekTo: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
  replace: jest.Mock;
  emit: (status: Record<string, unknown>) => void;
}

const players = (ExpoAudio as unknown as {__players: MockPlayer[]}).__players;
const flush = () => new Promise(r => setImmediate(r));

function status(currentTime: number, extra: Record<string, unknown> = {}) {
  return {
    isLoaded: true,
    currentTime,
    playing: true,
    isBuffering: false,
    didJustFinish: false,
    error: null,
    ...extra,
  };
}

const card = {
  key: 'card-1',
  url: 'https://audio.example.test/055.mp3',
  clip: {
    startMs: 120_000,
    endMs: 150_000,
    ayat: [
      {ayah: 1, startMs: 120_000, endMs: 130_000},
      {ayah: 2, startMs: 130_000, endMs: 150_000},
    ],
  },
};
const LOCAL = 'file:///cache/moments-clips/sn.mp3';

afterEach(() => {
  momentsAudioService.release();
  players.length = 0;
});

describe('MomentsAudioService with a cached clip', () => {
  it('plays the clip from 0 and reports surah positions', async () => {
    momentsAudioService.play(momentSourceFor(card, LOCAL));
    const player = players.find(p => p.url === LOCAL)!;
    expect(momentsAudioService.getState().positionMs).toBe(120_000);

    player.emit(status(0));
    await flush();
    expect(player.seekTo).toHaveBeenLastCalledWith(0);
    expect(player.play).toHaveBeenCalled();

    player.emit(status(12.5));
    expect(momentsAudioService.getState().positionMs).toBe(132_500);

    await momentsAudioService.seek(140_000);
    expect(player.seekTo).toHaveBeenLastCalledWith(20);
    expect(momentsAudioService.getState().positionMs).toBe(140_000);
  });

  it('ends at the clip length', async () => {
    const ended = jest.fn();
    const off = momentsAudioService.onEnded(ended);
    momentsAudioService.play(momentSourceFor(card, LOCAL));
    const player = players.find(p => p.url === LOCAL)!;
    player.emit(status(0));
    await flush();
    player.emit(status(29.9));
    expect(ended).not.toHaveBeenCalled();
    player.emit(status(30));
    expect(ended).toHaveBeenCalledWith('card-1');
    expect(momentsAudioService.getState().positionMs).toBe(150_000);
    off();
  });

  it('re-cues when a stale position from the previous file shows up', async () => {
    momentsAudioService.play(momentSourceFor(card, LOCAL));
    const player = players.find(p => p.url === LOCAL)!;
    player.emit(status(0));
    await flush();
    const ended = jest.fn();
    const off = momentsAudioService.onEnded(ended);
    player.emit(status(300));
    expect(ended).not.toHaveBeenCalled();
    player.emit(status(0));
    await flush();
    expect(player.seekTo).toHaveBeenCalledTimes(2);
    off();
  });

  it('falls back to the surah file when the clip fails to load', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    momentsAudioService.play(momentSourceFor(card, LOCAL));
    const player = players.find(p => p.url === LOCAL)!;
    player.emit(status(0, {isLoaded: false, error: 'bad file'}));
    expect(player.url).toBe(card.url);
    player.emit(status(0));
    await flush();
    expect(player.seekTo).toHaveBeenLastCalledWith(120);
    player.emit(status(125));
    expect(momentsAudioService.getState()).toMatchObject({
      key: 'card-1',
      positionMs: 125_000,
    });
  });
});

describe('MomentsAudioService across swipes', () => {
  const source = (n: number) => ({
    key: `card-${n}`,
    url: `https://audio.example.test/${n}.mp3`,
    startMs: 10_000,
    endMs: 20_000,
  });
  const playerFor = (n: number) => players.find(p => p.url === source(n).url)!;

  /** Plays card 1 and loads cards 2 (next) and 0 (previous) behind it. */
  async function start() {
    momentsAudioService.play(source(1));
    momentsAudioService.preload(source(2), source(0));
    players.forEach(p => p.emit(status(0)));
    await flush();
    playerFor(1).emit(status(10.1));
  }

  it('loads both neighbors into the idle players', async () => {
    await start();
    expect(players).toHaveLength(3);
    expect(players.map(p => p.url).sort()).toEqual(
      [0, 1, 2].map(n => source(n).url).sort(),
    );
    expect(playerFor(0).seekTo).toHaveBeenLastCalledWith(10);
    expect(playerFor(2).seekTo).toHaveBeenLastCalledWith(10);
    expect(playerFor(0).play).not.toHaveBeenCalled();
    expect(playerFor(2).play).not.toHaveBeenCalled();
  });

  it('starts a waiting neighbor at once, without a seek', async () => {
    await start();
    const next = playerFor(2);
    const seeks = next.seekTo.mock.calls.length;
    momentsAudioService.play(source(2));
    expect(next.play).toHaveBeenCalledTimes(1);
    expect(next.seekTo).toHaveBeenCalledTimes(seeks);
    expect(playerFor(1).pause).toHaveBeenCalled();
    expect(momentsAudioService.getState()).toMatchObject({
      key: 'card-2',
      playing: true,
    });
  });

  it('keeps the card swiped away loaded and rewinds it', async () => {
    await start();
    playerFor(1).emit(status(15));
    momentsAudioService.play(source(2));
    expect(playerFor(1).seekTo).toHaveBeenLastCalledWith(10);
    momentsAudioService.preload(source(3), source(1));
    // The new next card replaces card 0, not card 1.
    expect(players.find(p => p.url === source(0).url)).toBeUndefined();
    expect(playerFor(1)).toBeDefined();
  });

  it('replays a finished moment from the start when swiped back to', async () => {
    const ended = jest.fn();
    const off = momentsAudioService.onEnded(ended);
    await start();
    playerFor(1).emit(status(20));
    expect(ended).toHaveBeenCalledTimes(1);

    momentsAudioService.play(source(2));
    await flush();
    const first = playerFor(1);
    expect(first.seekTo).toHaveBeenLastCalledWith(10);

    momentsAudioService.play(source(1));
    expect(first.play).toHaveBeenCalledTimes(2);
    // A last status from before the rewind must not end it again.
    first.emit(status(20, {didJustFinish: true}));
    expect(ended).toHaveBeenCalledTimes(1);
    first.emit(status(0));
    await flush();
    first.emit(status(10.2));
    expect(momentsAudioService.getState()).toMatchObject({
      key: 'card-1',
      positionMs: 10_200,
    });
    off();
  });

  it('ignores a rewind that lands after the player got a new card', async () => {
    await start();
    const swiped = playerFor(1);
    let resolveSeek: () => void = () => undefined;
    swiped.seekTo.mockImplementationOnce(
      () => new Promise<void>(r => (resolveSeek = r)),
    );
    // Leaving card 1 rewinds it, and that seek hangs.
    momentsAudioService.play(source(2));
    // A jump to a card nobody preloaded reuses that player.
    momentsAudioService.play(source(3));
    expect(swiped.url).toBe(source(3).url);
    resolveSeek();
    await flush();
    const plays = swiped.play.mock.calls.length;
    // The new file loads: it must be cued to its own start, then played.
    swiped.emit(status(0));
    await flush();
    expect(swiped.seekTo).toHaveBeenLastCalledWith(10);
    expect(swiped.play).toHaveBeenCalledTimes(plays + 1);
    expect(momentsAudioService.getState()).toMatchObject({
      key: 'card-3',
      playing: true,
    });
  });

  it('does not start anything twice when a seek lands after a swipe', async () => {
    await start();
    momentsAudioService.play(source(2));
    playerFor(2).emit(status(12));
    let resolveSeek: () => void = () => undefined;
    playerFor(2).seekTo.mockImplementationOnce(
      () => new Promise<void>(r => (resolveSeek = r)),
    );
    // Leaving card 2 rewinds it, and that seek hangs.
    momentsAudioService.play(source(1));
    // Back to card 2 (it waits for the rewind), then on to card 0.
    momentsAudioService.play(source(2));
    momentsAudioService.play(source(0));
    const plays = playerFor(2).play.mock.calls.length;
    resolveSeek();
    await flush();
    expect(playerFor(2).play).toHaveBeenCalledTimes(plays);
    expect(playerFor(0).play).toHaveBeenCalledTimes(1);
    expect(momentsAudioService.getState()).toMatchObject({
      key: 'card-0',
      playing: true,
    });
  });
});
// @ai-end
