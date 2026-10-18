jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: jest.fn()},
}));
const mockListeners = new Set<() => void>();
const mockState: {
  queue: {tracks: Track[]; currentIndex: number};
  playback: {position: number};
} = {queue: {tracks: [], currentIndex: 0}, playback: {position: 0}};
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => mockState,
    subscribe: (listener: () => void) => {
      mockListeners.add(listener);
      return () => {
        mockListeners.delete(listener);
      };
    },
  },
}));

import {ayahAt, ayahLabel, startCarAyahTracker} from '../carAyah';
import {timestampService} from '@/services/timestamps/TimestampService';
import type {AyahTimestamp} from '@/types/timestamps';
import type {Track} from '@/types/audio';

function ts(ayahNumber: number, from: number, to: number): AyahTimestamp {
  return {
    surahNumber: 1,
    ayahNumber,
    timestampFrom: from,
    timestampTo: to,
    durationMs: to - from,
  };
}

const timestamps = [ts(1, 2000, 6000), ts(2, 6000, 9000), ts(3, 9000, 15000)];

describe('ayahAt', () => {
  it('is null before the first ayah starts (the opening)', () => {
    expect(ayahAt(timestamps, 0)).toBeNull();
    expect(ayahAt(timestamps, 1999)).toBeNull();
  });

  it('finds the ayah whose start is at or before the position', () => {
    expect(ayahAt(timestamps, 2000)).toBe(1);
    expect(ayahAt(timestamps, 5999)).toBe(1);
    expect(ayahAt(timestamps, 6000)).toBe(2);
    expect(ayahAt(timestamps, 14000)).toBe(3);
  });

  it('stays on the last ayah after its end', () => {
    expect(ayahAt(timestamps, 60000)).toBe(3);
  });

  it('is null with no timestamps', () => {
    expect(ayahAt([], 5000)).toBeNull();
  });
});

describe('ayahLabel', () => {
  it('reads as ayah of total', () => {
    expect(ayahLabel(12, 110)).toBe('Ayah 12 of 110');
  });
});

describe('startCarAyahTracker', () => {
  const getTimestamps = jest.mocked(timestampService.getTimestampsForSurah);

  function track(surahId: string, overrides: Partial<Track> = {}): Track {
    return {
      id: `t${surahId}`,
      url: 'u',
      title: 't',
      artist: 'a',
      reciterId: 'r1',
      reciterName: 'a',
      surahId,
      rewayatId: 'hafs',
      ...overrides,
    };
  }

  // Applies a player state change and notifies subscribers like zustand does.
  function setState(
    tracks: Track[],
    position: number,
    currentIndex: number = 0,
  ): void {
    mockState.queue = {tracks, currentIndex};
    mockState.playback = {position};
    mockListeners.forEach(listener => listener());
  }

  async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    mockListeners.clear();
    getTimestamps.mockReset();
    mockState.queue = {tracks: [track('1')], currentIndex: 0};
    mockState.playback = {position: 0};
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads timestamps for the playing rewayah and surah', async () => {
    getTimestamps.mockResolvedValue(timestamps);
    const stop = startCarAyahTracker(jest.fn());
    await flush();
    expect(getTimestamps).toHaveBeenCalledTimes(1);
    expect(getTimestamps).toHaveBeenCalledWith('hafs', 1);
    stop();
  });

  it('labels the ayah as the position advances across boundaries', async () => {
    getTimestamps.mockResolvedValue(timestamps);
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    await flush();
    // Still in the opening: nothing to say yet.
    expect(onLabel).not.toHaveBeenCalled();

    setState([track('1')], 3);
    expect(onLabel).toHaveBeenLastCalledWith('Ayah 1 of 7');
    setState([track('1')], 5.9);
    expect(onLabel).toHaveBeenCalledTimes(1);
    setState([track('1')], 6);
    expect(onLabel).toHaveBeenLastCalledWith('Ayah 2 of 7');
    setState([track('1')], 10);
    expect(onLabel).toHaveBeenLastCalledWith('Ayah 3 of 7');
    expect(onLabel.mock.calls.map(([label]) => label)).toEqual([
      'Ayah 1 of 7',
      'Ayah 2 of 7',
      'Ayah 3 of 7',
    ]);
    stop();
  });

  it('relabels after a seek backwards and clears when seeking before the first ayah', async () => {
    getTimestamps.mockResolvedValue(timestamps);
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    await flush();
    setState([track('1')], 10);
    expect(onLabel).toHaveBeenLastCalledWith('Ayah 3 of 7');
    setState([track('1')], 7);
    expect(onLabel).toHaveBeenLastCalledWith('Ayah 2 of 7');
    setState([track('1')], 0.5);
    expect(onLabel).toHaveBeenLastCalledWith(null);
    stop();
  });

  it('clears the label on track change and labels the new track once its timestamps load', async () => {
    getTimestamps.mockResolvedValue(timestamps);
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    await flush();
    setState([track('1')], 7);
    expect(onLabel).toHaveBeenLastCalledWith('Ayah 2 of 7');

    const secondSurah = [ts(1, 0, 4000), ts(2, 4000, 9000)];
    getTimestamps.mockResolvedValue(secondSurah);
    setState([track('1'), track('2')], 5, 1);
    expect(onLabel).toHaveBeenLastCalledWith(null);
    await flush();
    expect(getTimestamps).toHaveBeenLastCalledWith('hafs', 2);
    expect(onLabel).toHaveBeenLastCalledWith('Ayah 2 of 286');
    stop();
  });

  it('ignores timestamps that resolve after the track changed', async () => {
    let resolveFirst: (value: AyahTimestamp[]) => void = () => undefined;
    getTimestamps.mockImplementationOnce(
      () =>
        new Promise<AyahTimestamp[]>(resolve => {
          resolveFirst = resolve;
        }),
    );
    getTimestamps.mockResolvedValueOnce([ts(1, 0, 1000)]);
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    setState([track('1'), track('2')], 20, 1);
    await flush();
    onLabel.mockClear();
    // The slow load for surah 1 finishes late and must not label surah 2.
    resolveFirst([ts(1, 0, 1000), ts(2, 1000, 2000)]);
    await flush();
    expect(onLabel).not.toHaveBeenCalled();
    stop();
  });

  it('never labels when the reciter has no timestamps', async () => {
    getTimestamps.mockResolvedValueOnce([]);
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    await flush();
    setState([track('1')], 30);
    expect(onLabel).not.toHaveBeenCalled();
    stop();
  });

  it('never labels when the timestamp lookup finds nothing', async () => {
    getTimestamps.mockResolvedValueOnce(null);
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    await flush();
    setState([track('1')], 30);
    expect(onLabel).not.toHaveBeenCalled();
    stop();
  });

  it('never looks up or labels an upload', async () => {
    const upload = track('1', {isUserUpload: true, rewayatId: undefined});
    mockState.queue = {tracks: [upload], currentIndex: 0};
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    setState([upload], 30);
    await flush();
    expect(getTimestamps).not.toHaveBeenCalled();
    expect(onLabel).not.toHaveBeenCalled();
    stop();
  });

  it('clears a shown label when the next track has no timestamps', async () => {
    getTimestamps.mockResolvedValueOnce(timestamps);
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    await flush();
    setState([track('1')], 7);
    expect(onLabel).toHaveBeenLastCalledWith('Ayah 2 of 7');
    getTimestamps.mockResolvedValueOnce([]);
    setState([track('1'), track('2')], 7, 1);
    await flush();
    setState([track('1'), track('2')], 8, 1);
    expect(onLabel).toHaveBeenLastCalledWith(null);
    expect(onLabel).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stop clears the label, unsubscribes, and no further callbacks fire', async () => {
    getTimestamps.mockResolvedValue(timestamps);
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    await flush();
    setState([track('1')], 7);
    expect(onLabel).toHaveBeenLastCalledWith('Ayah 2 of 7');
    expect(mockListeners.size).toBe(1);

    stop();
    expect(onLabel).toHaveBeenLastCalledWith(null);
    expect(mockListeners.size).toBe(0);
    onLabel.mockClear();
    setState([track('1')], 10);
    setState([track('1'), track('2')], 1, 1);
    await flush();
    expect(onLabel).not.toHaveBeenCalled();
  });

  it('does not apply timestamps that finish loading after stop', async () => {
    let resolveLoad: (value: AyahTimestamp[]) => void = () => undefined;
    getTimestamps.mockImplementationOnce(
      () =>
        new Promise<AyahTimestamp[]>(resolve => {
          resolveLoad = resolve;
        }),
    );
    mockState.playback = {position: 7};
    const onLabel = jest.fn();
    const stop = startCarAyahTracker(onLabel);
    stop();
    resolveLoad(timestamps);
    await flush();
    expect(onLabel).not.toHaveBeenCalled();
  });
});
