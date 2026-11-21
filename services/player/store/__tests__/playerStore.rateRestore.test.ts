// @ai-generated
/**
 * The playback rate is saved with the player store. On launch the native
 * player is new and at 1x, so the restored rate has to be handed to the audio
 * service, or the controls show the saved rate while the audio plays at 1x.
 */

const mockStored = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k: string) => Promise.resolve(mockStored.get(k) ?? null)),
  setItem: jest.fn((k: string, v: string) => {
    mockStored.set(k, v);
    return Promise.resolve();
  }),
  removeItem: jest.fn((k: string) => {
    mockStored.delete(k);
    return Promise.resolve();
  }),
}));

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    loadTrack: jest.fn(() => Promise.resolve()),
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(() => Promise.resolve()),
    seekTo: jest.fn(() => Promise.resolve()),
    getDuration: jest.fn(() => 120),
    setRate: jest.fn(),
    cleanup: jest.fn(),
  },
}));

jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mainWillPlay: jest.fn()},
}));

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackPlaybackSkipped: jest.fn(),
    trackPlaybackSeeked: jest.fn(),
    trackRateChanged: jest.fn(),
  },
}));

type PlayerStoreModule = typeof import('../playerStore');
type AudioServiceModule = typeof import('@/services/audio/ExpoAudioService');

function persisted(rate: unknown): string {
  return JSON.stringify({
    state: {
      settings: {repeatMode: 'none', sleepTimer: 0, sleepTimerEnd: null},
      queue: {
        tracks: [],
        currentIndex: 0,
        total: 0,
        loading: false,
        endReached: false,
      },
      playback: {
        state: 'paused',
        position: 0,
        duration: 0,
        rate,
        buffering: false,
      },
    },
    version: 0,
  });
}

/** Loads a fresh store, as on app launch, and waits for it to hydrate. */
async function launch(): Promise<{
  store: PlayerStoreModule['usePlayerStore'];
  setRate: jest.Mock;
}> {
  let store!: PlayerStoreModule['usePlayerStore'];
  let setRate!: jest.Mock;
  jest.isolateModules(() => {
    const audio =
      require('@/services/audio/ExpoAudioService') as AudioServiceModule;
    setRate = audio.expoAudioService.setRate as unknown as jest.Mock;
    store = (require('../playerStore') as PlayerStoreModule).usePlayerStore;
  });
  if (!store.persist.hasHydrated()) {
    await new Promise<void>(resolve => {
      store.persist.onFinishHydration(() => resolve());
    });
  }
  return {store, setRate};
}

describe('playerStore: the saved rate on launch', () => {
  beforeEach(() => {
    mockStored.clear();
    jest.clearAllMocks();
  });

  it('hands the saved rate to the audio service', async () => {
    mockStored.set('player-store', persisted(2));

    const {store, setRate} = await launch();

    expect(store.getState().playback.rate).toBe(2);
    expect(setRate).toHaveBeenCalledWith(2);
  });

  it('shows 1x when the saved rate is not a usable number', async () => {
    mockStored.set('player-store', persisted(null));

    const {store, setRate} = await launch();

    expect(store.getState().playback.rate).toBe(1);
    expect(setRate).not.toHaveBeenCalled();
  });
});
