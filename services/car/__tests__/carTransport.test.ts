// Drives car transports through the bridge's listener into the player store.
import type {CarTransport} from '@/services/car/types';
import type {Track} from '@/types/audio';
import type {RepeatMode} from '@/services/player/types/state';
import {BayaanCar} from '@/modules/bayaan-car';

let mockTransportListener: ((transport: CarTransport) => void) | null = null;
let mockConnectionListener: ((connected: boolean) => void) | null = null;

jest.mock('@/modules/bayaan-car', () => ({
  BayaanCar: {
    isAvailable: true,
    markJsReady: jest.fn(),
    setNowPlaying: jest.fn(),
    addPlayRequestListener: () => jest.fn(),
    addTransportListener: (fn: (transport: CarTransport) => void) => {
      mockTransportListener = fn;
      return jest.fn();
    },
    addConnectionListener: (fn: (connected: boolean) => void) => {
      mockConnectionListener = fn;
      return jest.fn();
    },
  },
}));
const mockSetCarMode = jest.fn((_enabled: boolean): void => undefined);
const mockIsAdhkarHeld = jest.fn((): boolean => false);
const mockHasAdhkarTrackControls = jest.fn((): boolean => false);
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {
    setCarMode: (enabled: boolean) => mockSetCarMode(enabled),
    isAdhkarHeld: () => mockIsAdhkarHeld(),
    hasAdhkarTrackControls: () => mockHasAdhkarTrackControls(),
  },
}));
const mockSkipAdhkarTrack = jest.fn((_direction: string): void => undefined);
jest.mock('@/services/adhkar/playback/trackControls', () => ({
  skipAdhkarTrack: (direction: string) => mockSkipAdhkarTrack(direction),
}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {waitForPlayer: () => Promise.resolve()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/data/surahData', () => ({SURAHS: []}));
jest.mock('@/data/systemPlaylists', () => ({getSystemPlaylists: () => []}));
jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(),
  shuffleTracks: jest.fn(),
}));
jest.mock('@/services/car/CarSnapshotService', () => ({
  getLastResolveContext: () => null,
  writeCarSnapshotNow: jest.fn(),
}));
jest.mock('@/services/car/sessionGate', () => ({
  markCarReplacedQueue: jest.fn(),
  waitForSessionRestored: () => Promise.resolve(),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({recentTracks: []})},
}));
const mockToggleLoved = jest.fn();
jest.mock('@/services/player/store/lovedStore', () => ({
  useLovedStore: {
    getState: () => ({
      isLovedWithRewayat: () => false,
      toggleLoved: mockToggleLoved,
    }),
    subscribe: () => jest.fn(),
  },
}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {},
}));

function makeTrack(id: string, withRewayat: boolean = true): Track {
  return {
    id,
    url: `${id}.mp3`,
    title: id,
    artist: 'Mishary',
    reciterId: 'r1',
    reciterName: 'Mishary',
    surahId: '18',
    ...(withRewayat ? {rewayatId: 'hafs'} : {}),
  };
}

const mockQueue: {tracks: Track[]; currentIndex: number} = {
  tracks: [],
  currentIndex: 0,
};
const mockSettings: {repeatMode: RepeatMode} = {repeatMode: 'none'};
const mockPlayback = {state: 'playing', position: 0, duration: 0, rate: 1};
const mockSkipToNext = jest.fn(async (): Promise<void> => undefined);
const mockSkipToPrevious = jest.fn(async (): Promise<void> => undefined);
const mockPlay = jest.fn(async (): Promise<void> => undefined);
const mockPause = jest.fn(async (): Promise<void> => undefined);
const mockSeekTo = jest.fn(
  async (_position: number): Promise<void> => undefined,
);
const mockSetRepeatMode = jest.fn((_mode: RepeatMode): void => undefined);
const mockUpdateQueue = jest.fn(
  async (_tracks: Track[], _index?: number): Promise<void> => undefined,
);
const mockSetRate = jest.fn(async (rate: number): Promise<void> => {
  mockPlayback.rate = rate;
});
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: mockQueue,
      playback: mockPlayback,
      settings: mockSettings,
      setRate: mockSetRate,
      skipToNext: mockSkipToNext,
      skipToPrevious: mockSkipToPrevious,
      play: mockPlay,
      pause: mockPause,
      seekTo: mockSeekTo,
      setRepeatMode: mockSetRepeatMode,
      updateQueue: mockUpdateQueue,
    }),
    subscribe: () => jest.fn(),
  },
}));

import {Platform} from 'react-native';
import {startCarPlaybackBridge} from '../CarPlaybackBridge';

async function send(transport: CarTransport): Promise<void> {
  mockTransportListener?.(transport);
  await Promise.resolve();
}

describe('car transports', () => {
  beforeEach(() => {
    mockPlayback.rate = 1;
    mockQueue.tracks = [];
    mockQueue.currentIndex = 0;
    mockSettings.repeatMode = 'none';
    jest.clearAllMocks();
    mockIsAdhkarHeld.mockReturnValue(false);
    mockHasAdhkarTrackControls.mockReturnValue(false);
  });

  async function withBridge(run: () => Promise<void>): Promise<void> {
    const stop = startCarPlaybackBridge(Promise.resolve());
    try {
      await run();
    } finally {
      stop();
    }
  }

  it('next skips to the next track and nothing else', async () => {
    await withBridge(async () => {
      await send({kind: 'next'});
      expect(mockSkipToNext).toHaveBeenCalledTimes(1);
      expect(mockSkipToPrevious).not.toHaveBeenCalled();
    });
  });

  it('previous skips to the previous track and nothing else', async () => {
    await withBridge(async () => {
      await send({kind: 'previous'});
      expect(mockSkipToPrevious).toHaveBeenCalledTimes(1);
      expect(mockSkipToNext).not.toHaveBeenCalled();
    });
  });

  it('pushes now playing after car mode on a connection change', async () => {
    await withBridge(async () => {
      const setNowPlaying = jest.mocked(BayaanCar.setNowPlaying);
      const order: string[] = [];
      mockSetCarMode.mockImplementationOnce(() => order.push('carMode'));
      setNowPlaying.mockImplementationOnce(() => order.push('nowPlaying'));
      mockConnectionListener?.(true);
      expect(order).toEqual(['carMode', 'nowPlaying']);
    });
  });

  describe('while the adhkar session holds the lock screen', () => {
    const originalOS = Platform.OS;
    beforeEach(() => mockIsAdhkarHeld.mockReturnValue(true));
    afterEach(() => {
      Platform.OS = originalOS;
    });

    it('next and previous move the adhkar session, not the queue', async () => {
      await withBridge(async () => {
        await send({kind: 'next'});
        await send({kind: 'previous'});
        expect(mockSkipAdhkarTrack.mock.calls).toEqual([
          ['next'],
          ['previous'],
        ]);
        expect(mockSkipToNext).not.toHaveBeenCalled();
        expect(mockSkipToPrevious).not.toHaveBeenCalled();
      });
    });

    it('on iOS, leaves a press the adhkar entry already got alone', async () => {
      Platform.OS = 'ios';
      mockHasAdhkarTrackControls.mockReturnValue(true);
      await withBridge(async () => {
        await send({kind: 'next'});
        expect(mockSkipAdhkarTrack).not.toHaveBeenCalled();
        expect(mockSkipToNext).not.toHaveBeenCalled();
      });
    });

    it('on Android, moves the session even with the entry track controls on', async () => {
      Platform.OS = 'android';
      mockHasAdhkarTrackControls.mockReturnValue(true);
      await withBridge(async () => {
        await send({kind: 'next'});
        expect(mockSkipAdhkarTrack).toHaveBeenCalledWith('next');
      });
    });
  });

  it('play resumes playback without pausing', async () => {
    await withBridge(async () => {
      await send({kind: 'play'});
      expect(mockPlay).toHaveBeenCalledTimes(1);
      expect(mockPause).not.toHaveBeenCalled();
    });
  });

  it('pause pauses playback without playing', async () => {
    await withBridge(async () => {
      await send({kind: 'pause'});
      expect(mockPause).toHaveBeenCalledTimes(1);
      expect(mockPlay).not.toHaveBeenCalled();
    });
  });

  it('seek forwards the position and resyncs Now Playing afterwards', async () => {
    mockQueue.tracks = [makeTrack('a')];
    await withBridge(async () => {
      const setNowPlaying = jest.mocked(BayaanCar.setNowPlaying);
      setNowPlaying.mockClear();
      const order: string[] = [];
      mockSeekTo.mockImplementationOnce(async () => {
        order.push('seek');
      });
      setNowPlaying.mockImplementationOnce(() => {
        order.push('push');
      });
      await send({kind: 'seek', position: 42.5});
      await Promise.resolve();
      expect(mockSeekTo).toHaveBeenCalledWith(42.5);
      expect(order).toEqual(['seek', 'push']);
      expect(setNowPlaying).toHaveBeenCalledTimes(1);
    });
  });

  it('seek passes out-of-range positions through for the store to clamp', async () => {
    await withBridge(async () => {
      await send({kind: 'seek', position: -5});
      await send({kind: 'seek', position: 1e9});
      expect(mockSeekTo.mock.calls.map(([position]) => position)).toEqual([
        -5, 1e9,
      ]);
    });
  });

  it('jumpTo rebuilds the queue on the same tracks at the chosen index', async () => {
    const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c')];
    mockQueue.tracks = tracks;
    await withBridge(async () => {
      await send({kind: 'jumpTo', index: 2});
      expect(mockUpdateQueue).toHaveBeenCalledTimes(1);
      expect(mockUpdateQueue).toHaveBeenCalledWith(tracks, 2);
    });
  });

  it('jumpTo ignores an index at or past the end of the queue', async () => {
    mockQueue.tracks = [makeTrack('a'), makeTrack('b')];
    await withBridge(async () => {
      await send({kind: 'jumpTo', index: 2});
      await send({kind: 'jumpTo', index: 99});
      expect(mockUpdateQueue).not.toHaveBeenCalled();
    });
  });

  it('jumpTo ignores any index when the queue is empty', async () => {
    await withBridge(async () => {
      await send({kind: 'jumpTo', index: 0});
      expect(mockUpdateQueue).not.toHaveBeenCalled();
    });
  });

  it('toggleLove toggles the current track by reciter, surah and rewayah', async () => {
    mockQueue.tracks = [makeTrack('a'), {...makeTrack('b'), surahId: '36'}];
    mockQueue.currentIndex = 1;
    await withBridge(async () => {
      await send({kind: 'toggleLove'});
      expect(mockToggleLoved).toHaveBeenCalledTimes(1);
      expect(mockToggleLoved).toHaveBeenCalledWith('r1', '36', 'hafs');
    });
  });

  it('toggleLove does nothing for a track without a rewayah (an upload)', async () => {
    mockQueue.tracks = [makeTrack('a', false)];
    await withBridge(async () => {
      await send({kind: 'toggleLove'});
      expect(mockToggleLoved).not.toHaveBeenCalled();
    });
  });

  it('toggleLove does nothing with an empty queue', async () => {
    await withBridge(async () => {
      await send({kind: 'toggleLove'});
      expect(mockToggleLoved).not.toHaveBeenCalled();
    });
  });

  it.each<[RepeatMode, RepeatMode]>([
    ['none', 'queue'],
    ['queue', 'track'],
    ['track', 'none'],
  ])('cycleRepeat moves %s to %s', async (from, to) => {
    mockSettings.repeatMode = from;
    await withBridge(async () => {
      await send({kind: 'cycleRepeat'});
      expect(mockSetRepeatMode).toHaveBeenCalledTimes(1);
      expect(mockSetRepeatMode).toHaveBeenCalledWith(to);
    });
  });

  it('cycleRate steps the store rate through 1.25, 1.5, 0.75 and back to 1', async () => {
    const stop = startCarPlaybackBridge(Promise.resolve());
    await send({kind: 'cycleRate'});
    await send({kind: 'cycleRate'});
    await send({kind: 'cycleRate'});
    await send({kind: 'cycleRate'});
    expect(mockSetRate.mock.calls.map(([rate]) => rate)).toEqual([
      1.25, 1.5, 0.75, 1,
    ]);
    stop();
  });

  it('applies an explicit rate from the car rate command', async () => {
    const stop = startCarPlaybackBridge(Promise.resolve());
    await send({kind: 'rate', value: 1.5});
    expect(mockSetRate).toHaveBeenCalledWith(1.5);
    stop();
  });
});
