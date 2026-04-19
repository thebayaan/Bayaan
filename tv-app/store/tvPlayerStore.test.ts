import {useTVPlayerStore} from './tvPlayerStore';
import type {AudioEngine, EngineEvent} from '../services/audioEngine';

function makeMockEngine(): AudioEngine & {emit: (e: EngineEvent) => void} {
  let listener: ((e: EngineEvent) => void) | null = null;
  return {
    load: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    seek: jest.fn(),
    setRate: jest.fn(),
    subscribe: cb => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
    emit: e => listener?.(e),
  };
}

const queue = [
  {
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: 1,
    audioUrl: 'https://x/001.mp3',
    title: 'Al-Fatihah',
    subtitle: 'al-Afasy',
  },
  {
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: 2,
    audioUrl: 'https://x/002.mp3',
    title: 'Al-Baqarah',
    subtitle: 'al-Afasy',
  },
  {
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: 3,
    audioUrl: 'https://x/003.mp3',
    title: 'Aal-Imran',
    subtitle: 'al-Afasy',
  },
];

describe('tvPlayerStore', () => {
  beforeEach(() => {
    useTVPlayerStore.getState().reset();
  });

  it('starts idle with empty queue', () => {
    const s = useTVPlayerStore.getState();
    expect(s.status).toBe('idle');
    expect(s.queue).toEqual([]);
  });

  it('loadQueue loads first item and plays', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    expect(engine.load).toHaveBeenCalledWith('https://x/001.mp3');
    expect(engine.play).toHaveBeenCalled();
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
  });

  it('next advances index and loads next track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    await useTVPlayerStore.getState().next();
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
    expect(engine.load).toHaveBeenLastCalledWith('https://x/002.mp3');
  });

  it('next at end with repeat=off stays put', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 2);
    await useTVPlayerStore.getState().next();
    expect(useTVPlayerStore.getState().currentIndex).toBe(2);
  });

  it('next at end with repeat=all wraps to 0', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 2);
    useTVPlayerStore.getState().setRepeat('all');
    await useTVPlayerStore.getState().next();
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
  });

  it('prev within first 3 seconds goes to previous track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 2);
    engine.emit({status: 'playing', positionSeconds: 1, durationSeconds: 60});
    await useTVPlayerStore.getState().prev();
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
  });

  it('prev after 3 seconds restarts current track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 1);
    engine.emit({status: 'playing', positionSeconds: 10, durationSeconds: 60});
    await useTVPlayerStore.getState().prev();
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
    expect(engine.seek).toHaveBeenCalledWith(0);
  });

  it('seekBy(15) calls engine.seek with position + 15', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    engine.emit({status: 'playing', positionSeconds: 20, durationSeconds: 60});
    useTVPlayerStore.getState().seekBy(15);
    expect(engine.seek).toHaveBeenCalledWith(35);
  });

  it('toggle pauses when playing', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    engine.emit({status: 'playing', positionSeconds: 5, durationSeconds: 60});
    useTVPlayerStore.getState().toggle();
    expect(engine.pause).toHaveBeenCalled();
  });

  it('auto-advances when engine emits status=idle at end of track', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(queue, 0);
    engine.emit({
      status: 'playing',
      positionSeconds: 59.9,
      durationSeconds: 60,
    });
    engine.emit({status: 'idle', positionSeconds: 60, durationSeconds: 60});
    await new Promise(r => setTimeout(r, 10));
    expect(useTVPlayerStore.getState().currentIndex).toBe(1);
  });

  it('setSpeed calls engine.setRate', async () => {
    const engine = makeMockEngine();
    useTVPlayerStore.getState().setEngine(engine);
    useTVPlayerStore.getState().setSpeed(1.5);
    expect(engine.setRate).toHaveBeenCalledWith(1.5);
  });
});
