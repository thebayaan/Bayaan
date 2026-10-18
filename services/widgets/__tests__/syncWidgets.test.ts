import type {QueuedWidgetCommand, WidgetCommand} from 'bayaan-widgets';

const mockTakeQueuedCommands = jest.fn<QueuedWidgetCommand[], []>();
const mockHandleWidgetCommand = jest.fn<Promise<void>, [WidgetCommand]>();

const mockCachedFiles = new Set<string>();
const mockWriteSnapshot = jest.fn();
const mockReloadWidgets = jest.fn();
const mockCacheArtwork = jest.fn<Promise<boolean>, [string, string]>();
const mockChangedKinds = jest.fn<string[], []>();
const mockBuildSnapshot = jest.fn();
const mockCollect = jest.fn();
const mockReciterById = jest.fn();
const mockCommandRemove = jest.fn();
const mockAppStateRemove = jest.fn();
let mockAppStateCurrent = 'active';
let mockPlatformOS = 'android';
const mockUnsubs: jest.Mock[] = [];
const mockCallbacks: Array<() => void> = [];
const mockSubscribe = jest.fn((cb: () => void) => {
  mockCallbacks.push(cb);
  const unsub = jest.fn();
  mockUnsubs.push(unsub);
  return unsub;
});

jest.mock('bayaan-widgets', () => ({
  changedWidgetKinds: () => mockChangedKinds(),
  isWidgetsAvailable: jest.fn(() => true),
  reloadWidgets: (k: unknown) => mockReloadWidgets(k),
  writeSnapshot: (s: unknown) => mockWriteSnapshot(s),
  cacheArtwork: (u: string, f: string) => mockCacheArtwork(u, f),
  hasArtwork: (f: string) => mockCachedFiles.has(f),
  addWidgetCommandListener: jest.fn(() => ({remove: mockCommandRemove})),
  takeQueuedCommands: () => mockTakeQueuedCommands(),
  selectFreshCommands: (queued: QueuedWidgetCommand[]) =>
    queued.map(q => q.command),
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const appState = {
    addEventListener: () => ({remove: mockAppStateRemove}),
    get currentState(): string {
      return mockAppStateCurrent;
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
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {subscribe: (cb: () => void) => mockSubscribe(cb)},
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {subscribe: (cb: () => void) => mockSubscribe(cb)},
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {subscribe: (cb: () => void) => mockSubscribe(cb)},
}));
jest.mock('@/store/themeStore', () => ({
  useThemeStore: {subscribe: (cb: () => void) => mockSubscribe(cb)},
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) => mockReciterById(id),
}));
jest.mock('@/utils/artworkUtils', () => ({
  getReciterArtwork: (r: {id: string}) => `https://x/${r.id}.jpg`,
}));
jest.mock('../buildSnapshot', () => ({
  buildSnapshot: () => mockBuildSnapshot(),
  artworkFileName: (id: string) => `reciter-${id}.jpg`,
  cardSurahId: (id: number, upload: boolean) =>
    !upload && id >= 1 && id <= 114 ? id : null,
  surahArtworkFileName: (id: number) => `surah-${id}.jpg`,
  surahArtworkUrl: (id: number) => `https://cdn/surah/${id}.png`,
}));
jest.mock('../collectSnapshotInput', () => ({
  collectSnapshotInput: () => mockCollect(),
}));
jest.mock('../handleWidgetCommand', () => ({
  handleWidgetCommand: (command: WidgetCommand) =>
    mockHandleWidgetCommand(command),
}));

const mockNoteSnapshot = jest.fn();
jest.mock('../live-activity/syncLiveActivity', () => ({
  noteSnapshotForLiveActivity: (s: unknown) => mockNoteSnapshot(s),
}));

type SyncModule = typeof import('../syncWidgets');

function queued(command: WidgetCommand): QueuedWidgetCommand {
  return {command, enqueuedAt: Date.now()};
}

const toggle: WidgetCommand = {type: 'setPlayback', playing: true};
const playReciter: WidgetCommand = {type: 'playReciter', reciterId: 'r1'};

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

function loadModule(): SyncModule {
  let mod: SyncModule | null = null;
  jest.isolateModules(() => {
    mod = require('../syncWidgets');
  });
  if (!mod) throw new Error('module failed to load');
  return mod;
}

describe('drainWidgetCommands', () => {
  beforeEach(() => {
    mockTakeQueuedCommands.mockReset();
    mockTakeQueuedCommands.mockReturnValue([]);
    mockHandleWidgetCommand.mockReset();
    mockHandleWidgetCommand.mockResolvedValue(undefined);
    mockWriteSnapshot.mockReset();
    mockReloadWidgets.mockReset();
    mockChangedKinds.mockReset();
    mockChangedKinds.mockReturnValue([]);
    mockBuildSnapshot.mockReset();
    mockBuildSnapshot.mockReturnValue(snapshotWithReciters([]));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('forces a Continue Listening write after handling a command', async () => {
    const sync = loadModule();
    sync.markSessionRestoredForWidgets();
    sync.markPlayerReadyForWidgets();
    await flush();
    mockWriteSnapshot.mockClear();
    mockReloadWidgets.mockClear();
    mockTakeQueuedCommands.mockReturnValueOnce([queued(toggle)]);
    mockTakeQueuedCommands.mockReturnValue([]);
    await sync.drainWidgetCommands();
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(1);
    expect(mockReloadWidgets).toHaveBeenCalledWith(['ContinueListening']);
  });

  it('hands each written snapshot to the Live Activity', async () => {
    const sync = loadModule();
    sync.markSessionRestoredForWidgets();
    sync.markPlayerReadyForWidgets();
    await flush();
    mockWriteSnapshot.mockClear();
    mockNoteSnapshot.mockClear();
    mockTakeQueuedCommands.mockReturnValueOnce([queued(toggle)]);
    mockTakeQueuedCommands.mockReturnValue([]);
    await sync.drainWidgetCommands();
    expect(mockNoteSnapshot).toHaveBeenCalledTimes(1);
    expect(mockNoteSnapshot).toHaveBeenCalledWith(
      mockWriteSnapshot.mock.calls[0][0],
    );
  });

  it('does not write a snapshot when no command was handled', async () => {
    const sync = loadModule();
    sync.markSessionRestoredForWidgets();
    sync.markPlayerReadyForWidgets();
    await flush();
    await sync.drainWidgetCommands();
    expect(mockWriteSnapshot).not.toHaveBeenCalled();
  });

  it('does nothing before the session is restored', async () => {
    const sync = loadModule();
    mockTakeQueuedCommands.mockReturnValue([queued(toggle)]);
    sync.markPlayerReadyForWidgets();
    await sync.drainWidgetCommands();
    expect(mockHandleWidgetCommand).not.toHaveBeenCalled();
    sync.markSessionRestoredForWidgets();
    await flush();
    expect(mockHandleWidgetCommand).toHaveBeenCalledWith(toggle);
  });

  it('does nothing before the player is ready', async () => {
    const sync = loadModule();
    mockTakeQueuedCommands.mockReturnValue([queued(toggle)]);
    await sync.drainWidgetCommands();
    expect(mockTakeQueuedCommands).not.toHaveBeenCalled();
    expect(mockHandleWidgetCommand).not.toHaveBeenCalled();
  });

  it('drains once markPlayerReadyForWidgets is called', async () => {
    const sync = loadModule();
    mockTakeQueuedCommands.mockReturnValueOnce([queued(toggle)]);
    mockTakeQueuedCommands.mockReturnValue([]);
    sync.markSessionRestoredForWidgets();
    sync.markPlayerReadyForWidgets();
    await sync.drainWidgetCommands();
    expect(mockHandleWidgetCommand).toHaveBeenCalledWith(toggle);
  });

  it('continues past a command that throws', async () => {
    const sync = loadModule();
    sync.markSessionRestoredForWidgets();
    sync.markPlayerReadyForWidgets();
    await flush();
    mockHandleWidgetCommand.mockReset();
    mockTakeQueuedCommands.mockReset();
    mockTakeQueuedCommands.mockReturnValueOnce([
      queued(playReciter),
      queued(toggle),
    ]);
    mockTakeQueuedCommands.mockReturnValue([]);
    mockHandleWidgetCommand
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);
    await sync.drainWidgetCommands();
    expect(mockHandleWidgetCommand).toHaveBeenCalledTimes(2);
    expect(mockHandleWidgetCommand).toHaveBeenLastCalledWith(toggle);
    expect(console.error).toHaveBeenCalled();
  });

  it('never runs two drains concurrently and re-drains without dropping commands', async () => {
    const sync = loadModule();
    sync.markSessionRestoredForWidgets();
    sync.markPlayerReadyForWidgets();
    await flush();
    mockHandleWidgetCommand.mockReset();
    mockTakeQueuedCommands.mockReset();

    let release: () => void = () => undefined;
    let active = 0;
    let maxActive = 0;
    mockHandleWidgetCommand.mockImplementation(async command => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (command === toggle) {
        await new Promise<void>(resolve => {
          release = resolve;
        });
      }
      active -= 1;
    });
    mockTakeQueuedCommands
      .mockReturnValueOnce([queued(toggle)])
      .mockReturnValueOnce([queued(playReciter)])
      .mockReturnValue([]);

    const first = sync.drainWidgetCommands();
    await Promise.resolve();
    const second = sync.drainWidgetCommands();
    await second;
    expect(mockHandleWidgetCommand).toHaveBeenCalledTimes(1);

    release();
    await first;
    expect(mockHandleWidgetCommand).toHaveBeenCalledTimes(2);
    expect(mockHandleWidgetCommand).toHaveBeenLastCalledWith(playReciter);
    expect(maxActive).toBe(1);
  });
});

function snapshotWithReciters(ids: string[]): unknown {
  return {
    nowPlaying: null,
    upNext: [],
    recent: ids.map(id => ({reciterId: id, isUserUpload: false})),
    defaultReciter: null,
  };
}

describe('widget snapshot flush', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockWriteSnapshot.mockReset();
    mockReloadWidgets.mockReset();
    mockCacheArtwork.mockReset();
    mockCachedFiles.clear();
    mockChangedKinds.mockReset();
    mockChangedKinds.mockReturnValue(['ContinueListening']);
    mockBuildSnapshot.mockReset();
    mockBuildSnapshot.mockReturnValue(snapshotWithReciters([]));
    mockCollect.mockReset();
    mockReciterById.mockReset();
    mockSubscribe.mockClear();
    mockUnsubs.length = 0;
    mockCallbacks.length = 0;
    mockCommandRemove.mockClear();
    mockAppStateRemove.mockClear();
    mockAppStateCurrent = 'active';
    mockPlatformOS = 'android';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(console.error).mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('writes a snapshot after the debounce', () => {
    const sync = loadModule();
    const stop = sync.startWidgetSync();
    expect(mockWriteSnapshot).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(1);
    expect(mockReloadWidgets).toHaveBeenCalledWith(['ContinueListening']);
    stop();
  });

  it('keeps the debounce in the background on iOS, where timers run', () => {
    mockAppStateCurrent = 'background';
    mockPlatformOS = 'ios';
    const sync = loadModule();
    const stop = sync.startWidgetSync();
    expect(mockWriteSnapshot).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(1);
    stop();
  });

  it('flushes at once in the background on Android (timers are paused)', () => {
    mockAppStateCurrent = 'background';
    const sync = loadModule();
    const stop = sync.startWidgetSync();
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(1);
    const tick = mockCallbacks[0];
    if (!tick) throw new Error('no subscriber');
    tick();
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(2);
    stop();
  });

  it('flushes within the max wait under continuous updates', () => {
    const sync = loadModule();
    const stop = sync.startWidgetSync();
    jest.advanceTimersByTime(1000);
    mockWriteSnapshot.mockClear();
    const tick = mockCallbacks[0];
    if (!tick) throw new Error('no subscriber');
    // A store update every 400 ms must not starve the flush.
    for (let elapsed = 0; elapsed < 1000; elapsed += 400) {
      tick();
      jest.advanceTimersByTime(400);
    }
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not throw when buildSnapshot or writeSnapshot throws', () => {
    const sync = loadModule();
    mockBuildSnapshot.mockImplementation(() => {
      throw new Error('build');
    });
    expect(() => sync.flushWidgetSnapshot()).not.toThrow();
    mockBuildSnapshot.mockReturnValue(snapshotWithReciters([]));
    mockWriteSnapshot.mockImplementation(() => {
      throw new Error('write');
    });
    expect(() => sync.flushWidgetSnapshot()).not.toThrow();
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('still caches reciter B when reciter A artwork rejects', async () => {
    const sync = loadModule();
    mockBuildSnapshot.mockReturnValue(snapshotWithReciters(['a', 'b']));
    mockReciterById.mockImplementation((id: string) => ({id}));
    mockCacheArtwork.mockImplementation(async (_url, file) => {
      if (file.includes('a')) throw new Error('net');
      mockCachedFiles.add(file);
      return true;
    });
    sync.flushWidgetSnapshot();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockCacheArtwork).toHaveBeenCalledWith(
      'https://x/b.jpg',
      'reciter-b.jpg',
    );
    // Artwork added for B triggers a second flush.
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(2);
  });

  it('reloads the configured widgets when it caches artwork they may show', async () => {
    const sync = loadModule();
    mockChangedKinds.mockReturnValue(['ContinueListening']);
    mockBuildSnapshot.mockReturnValue({
      nowPlaying: {track: {surahId: 55, reciterId: '', isUserUpload: false}},
      upNext: [],
      recent: [],
      defaultReciter: null,
    });
    mockCacheArtwork.mockImplementation(async (_url, file) => {
      mockCachedFiles.add(file);
      return true;
    });
    sync.flushWidgetSnapshot();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockReloadWidgets).toHaveBeenCalledWith([
      'QuickSurah',
      'PinnedReciter',
      'ContinueReading',
    ]);
  });

  it('caches the surah card of every track but not of uploads', async () => {
    const sync = loadModule();
    mockBuildSnapshot.mockReturnValue({
      nowPlaying: {track: {surahId: 18, reciterId: '', isUserUpload: false}},
      upNext: [{surahId: 36, reciterId: '', isUserUpload: true}],
      recent: [],
      defaultReciter: null,
    });
    mockCacheArtwork.mockResolvedValue(false);
    sync.flushWidgetSnapshot();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockCacheArtwork).toHaveBeenCalledTimes(1);
    expect(mockCacheArtwork).toHaveBeenCalledWith(
      'https://cdn/surah/18.png',
      'surah-18.jpg',
    );
  });

  it('does not retry a failing artwork URL within the window, then does', async () => {
    const sync = loadModule();
    mockBuildSnapshot.mockReturnValue(snapshotWithReciters(['a']));
    mockReciterById.mockImplementation((id: string) => ({id}));
    mockCacheArtwork.mockRejectedValue(new Error('net'));
    sync.flushWidgetSnapshot();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockCacheArtwork).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + 9 * 60 * 1000);
    sync.flushWidgetSnapshot();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockCacheArtwork).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + 2 * 60 * 1000);
    sync.flushWidgetSnapshot();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockCacheArtwork).toHaveBeenCalledTimes(2);
  });

  it('does not request a URL that is already in flight', async () => {
    const sync = loadModule();
    mockBuildSnapshot.mockReturnValue(snapshotWithReciters(['a']));
    mockReciterById.mockImplementation((id: string) => ({id}));
    let finish: (ok: boolean) => void = () => undefined;
    mockCacheArtwork.mockImplementation(
      () =>
        new Promise<boolean>(resolve => {
          finish = resolve;
        }),
    );
    sync.flushWidgetSnapshot();
    await jest.advanceTimersByTimeAsync(0);
    sync.flushWidgetSnapshot();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockCacheArtwork).toHaveBeenCalledTimes(1);
    finish(false);
  });

  it('cleanup removes listeners and clears the pending timer', () => {
    const sync = loadModule();
    const stop = sync.startWidgetSync();
    stop();
    expect(mockUnsubs).toHaveLength(4);
    mockUnsubs.forEach(u => expect(u).toHaveBeenCalled());
    expect(mockAppStateRemove).toHaveBeenCalled();
    expect(mockCommandRemove).toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(mockWriteSnapshot).not.toHaveBeenCalled();
  });
});
