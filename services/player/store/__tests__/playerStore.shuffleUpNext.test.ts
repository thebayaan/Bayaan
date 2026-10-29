// @ai-generated
jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    getItem: jest.fn((k: string) => Promise.resolve(mem.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      mem.set(k, v);
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      mem.delete(k);
      return Promise.resolve();
    }),
  };
});
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    loadTrack: jest.fn(),
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(() => Promise.resolve()),
    cleanup: jest.fn(),
  },
}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mainWillPlay: jest.fn()},
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {},
}));

import {usePlayerStore} from '../playerStore';
import type {Track} from '@/types/audio';

const track = (id: string) => ({id, title: id}) as unknown as Track;

function setQueue(ids: string[], currentIndex: number) {
  usePlayerStore.setState(state => ({
    queue: {...state.queue, tracks: ids.map(track), currentIndex},
  }));
}

const ids = () => usePlayerStore.getState().queue.tracks.map(t => t.id);

describe('shuffleUpNext', () => {
  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('shuffles only the tracks after the current one', () => {
    setQueue(['a', 'b', 'c', 'd', 'e', 'f'], 2);
    // Math.random() = 0 swaps each slot with the first: [d,e,f] -> [e,f,d].
    jest.spyOn(Math, 'random').mockReturnValue(0);

    usePlayerStore.getState().shuffleUpNext();

    expect(ids()).toEqual(['a', 'b', 'c', 'e', 'f', 'd']);
    expect(usePlayerStore.getState().queue.currentIndex).toBe(2);
  });

  it('keeps every track exactly once', () => {
    setQueue(['a', 'b', 'c', 'd', 'e'], 0);
    usePlayerStore.getState().shuffleUpNext();
    expect(ids()[0]).toBe('a');
    expect([...ids()].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
