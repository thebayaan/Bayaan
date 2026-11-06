import type {
  ActivityStartResult,
  NowPlayingActivityState,
  WidgetNowPlaying,
} from 'bayaan-widgets';
import {activityStateFromSnapshot} from '../planActivity';
import {
  MULK_TRACK,
  YASIN_TRACK,
  nowPlayingSnapshot,
} from '@/test-utils/widgetSnapshots';

const mockLog: string[] = [];
const mockStart = jest.fn<
  Promise<ActivityStartResult>,
  [NowPlayingActivityState, number]
>();
const mockUpdate = jest.fn<
  Promise<boolean>,
  [NowPlayingActivityState, number]
>();
const mockEnd = jest.fn<Promise<void>, []>();
let mockSurvivor: NowPlayingActivityState | null = null;
let mockSupported = true;
let mockPlatformOS = 'ios';
let mockMode: 'off' | 'surah' | 'ayah' = 'surah';
let mockAppStateListener: ((state: string) => void) | null = null;

function mockDescribe(s: NowPlayingActivityState): string {
  return `${s.surahName}:${s.isPlaying ? 'playing' : 'paused'}:${
    s.ayah ? s.ayah.number : '-'
  }`;
}

jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  isLiveActivitySupported: () => mockSupported,
  startNowPlayingActivity: (s: NowPlayingActivityState, at: number) => {
    mockLog.push(`start:${mockDescribe(s)}`);
    return mockStart(s, at);
  },
  updateNowPlayingActivity: (s: NowPlayingActivityState, at: number) => {
    mockLog.push(`update:${mockDescribe(s)}`);
    return mockUpdate(s, at);
  },
  currentNowPlayingActivity: () => mockSurvivor,
  endNowPlayingActivities: () => {
    mockLog.push('end');
    return mockEnd();
  },
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const appState = {
    addEventListener: (_event: string, cb: (state: string) => void) => {
      mockAppStateListener = cb;
      return {remove: jest.fn()};
    },
  };
  const platform = {
    get OS(): string {
      return mockPlatformOS;
    },
  };
  return new Proxy(actual, {
    get: (target, prop) => {
      if (prop === 'AppState') return appState;
      if (prop === 'Platform') return platform;
      return target[prop];
    },
  });
});
jest.mock('../config', () => ({liveActivityMode: () => mockMode}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: jest.fn(async () => [
      {
        surahNumber: 18,
        ayahNumber: 1,
        timestampFrom: 0,
        timestampTo: 600000,
        durationMs: 600000,
      },
    ]),
  },
}));
const mockEnsureRewayahLoaded = jest.fn(async (_rewayah: string) => undefined);
const mockGetVerseText = jest.fn(
  (_key: string, _rewayah?: string) => 'ayah text',
);
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    getVerseText: (key: string, rewayah?: string) =>
      mockGetVerseText(key, rewayah),
    ensureRewayahLoaded: (rewayah: string) => mockEnsureRewayahLoaded(rewayah),
  },
}));
// A Hafs-numbered set: entry N is Hafs ayah N.
jest.mock('@/services/timestamps/TimingNumberingService', () => ({
  timingNumberingService: {
    resolve: jest.fn(async (_rw: string, surah: number) => ({
      surah,
      mode: 'hafs',
      hafsKeysForEntry: (entryAyah: number) => [`${surah}:${entryAyah}`],
    })),
  },
}));

type SyncModule = typeof import('../syncLiveActivity');

function loadModule(): SyncModule {
  let mod: SyncModule | null = null;
  jest.isolateModules(() => {
    mod = require('../syncLiveActivity');
  });
  if (!mod) throw new Error('module failed to load');
  return mod;
}

function survivorFor(np: Partial<WidgetNowPlaying>): NowPlayingActivityState {
  const state = activityStateFromSnapshot(
    nowPlayingSnapshot(np),
    null,
    1_000_000,
  );
  if (!state) throw new Error('expected a state');
  return state;
}

describe('syncLiveActivity', () => {
  beforeEach(() => {
    mockLog.length = 0;
    mockStart.mockReset().mockResolvedValue('started');
    mockUpdate.mockReset().mockResolvedValue(true);
    mockEnd.mockReset().mockResolvedValue(undefined);
    mockSupported = true;
    mockPlatformOS = 'ios';
    mockMode = 'surah';
    mockAppStateListener = null;
    mockSurvivor = null;
    // Snapshots are generated at 1_000_000 ms; keep "now" at their anchor.
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing off iOS or when unsupported', async () => {
    for (const setup of [
      () => (mockPlatformOS = 'android'),
      () => (mockSupported = false),
    ]) {
      setup();
      const sync = loadModule();
      sync.startLiveActivitySync();
      sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
      await sync.reconcileLiveActivity();
      mockPlatformOS = 'ios';
      mockSupported = true;
    }
    expect(mockLog).toEqual([]);
  });

  it('with the mode off, ends a surviving activity and starts nothing', async () => {
    mockMode = 'off';
    mockSurvivor = survivorFor({});
    const sync = loadModule();
    sync.startLiveActivitySync();
    await Promise.resolve();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['end']);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('starts without ending anything when no activity survived', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['start:Al-Kahf:playing:-']);
  });

  it('adopts a surviving activity that matches the restored track', async () => {
    mockSurvivor = survivorFor({isPlaying: false, positionSec: 100});
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual([]);
    // Playback resumes: the adopted activity is updated, not recreated.
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['update:Al-Kahf:playing:-']);
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it('ends a surviving activity for a different track, then starts', async () => {
    mockSurvivor = survivorFor({track: YASIN_TRACK});
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['end', 'start:Al-Kahf:playing:-']);
  });

  it('ends a surviving activity when nothing is restored', async () => {
    mockSurvivor = survivorFor({});
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot(null));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual(['end']);
  });

  it('does not start for a paused session', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual([]);
  });

  it('updates on pause and ends when the queue clears', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot(null));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual([
      'start:Al-Kahf:playing:-',
      'update:Al-Kahf:paused:-',
      'end',
    ]);
  });

  it('collapses rapid track changes into one start', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({track: YASIN_TRACK}));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({track: MULK_TRACK}));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockLog).toEqual(['start:Al-Mulk:playing:-']);
  });

  it('retries a deferred start on foreground', async () => {
    mockStart.mockResolvedValueOnce('deferred');
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    mockAppStateListener?.('active');
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('does not restart a dismissed activity for the same track', async () => {
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    mockUpdate.mockResolvedValueOnce(false);
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({track: YASIN_TRACK}));
    await sync.reconcileLiveActivity();
    expect(mockLog).toEqual([
      'start:Al-Kahf:playing:-',
      'update:Al-Kahf:paused:-',
      'start:Ya-Sin:playing:-',
    ]);
  });

  it('does not retry a disabled start for the same track', async () => {
    mockStart.mockResolvedValue('disabled');
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('shows the activity again for the same surah after the queue clears', async () => {
    mockUpdate.mockResolvedValue(false);
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    // The user dismisses it: the next update finds it gone, so Al-Kahf is suppressed.
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot(null));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('stops reacting after cleanup', async () => {
    const sync = loadModule();
    const stop = sync.startLiveActivitySync();
    stop();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('treats a rejecting native start as a failed start', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockStart.mockRejectedValue(new Error('native boom'));
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('treats a rejecting native update as a failed update', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await sync.reconcileLiveActivity();
    mockUpdate.mockRejectedValueOnce(new Error('native boom'));
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({isPlaying: false}));
    await sync.reconcileLiveActivity();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}, 2_000_000));
    await sync.reconcileLiveActivity();
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('survives a rejecting end', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockEnd.mockRejectedValue(new Error('native boom'));
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(nowPlayingSnapshot({}));
    await expect(sync.reconcileLiveActivity()).resolves.toBeUndefined();
  });

  it('adds the current ayah in ayah mode', async () => {
    mockMode = 'ayah';
    const sync = loadModule();
    sync.startLiveActivitySync();
    sync.noteSnapshotForLiveActivity(
      nowPlayingSnapshot({positionSec: 10}, Date.now()),
    );
    for (let i = 0; i < 10; i += 1) await sync.reconcileLiveActivity();
    // The ayah may arrive before or after the start runs; either way there is
    // one activity and the last state sent carries ayah 1.
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockLog[mockLog.length - 1]).toMatch(
      /^(start|update):Al-Kahf:playing:1$/,
    );
    // The ayah line is Hafs text, whatever rewayah the mushaf shows.
    expect(mockEnsureRewayahLoaded).toHaveBeenCalledWith('hafs');
    expect(mockGetVerseText).toHaveBeenCalledWith('18:1', 'hafs');
  });
});
