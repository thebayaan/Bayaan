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
// @ai-end
