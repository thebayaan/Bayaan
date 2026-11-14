// @ai-generated
/**
 * Who holds the lock screen between the main player and verse audio in the
 * Mushaf, and what artwork the main player may hand to the native side.
 */

const mockMainPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};

let mockMushafPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};

let mockActiveSource = 'none';
let mockLocalUri: string | null = 'file:///cache/reciter.png';

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      queue: {tracks: [], currentIndex: 0},
      playback: {state: 'paused'},
    })),
  };
});

jest.mock('@/store/mushafPlayerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useMushafPlayerStore: create(() => ({
      playbackState: 'idle',
      currentSurah: 0,
      currentVerseKey: null,
      currentVerseLabel: null,
      numberingMode: null,
      reciterName: 'Test Reciter',
    })),
  };
});

jest.mock('../ExpoAudioService', () => ({
  expoAudioService: {getPlayer: () => mockMainPlayer},
}));

jest.mock('../MushafAudioService', () => ({
  mushafAudioService: {getPlayer: () => mockMushafPlayer},
}));

jest.mock('../AudioCoordinator', () => ({
  audioCoordinator: {getActiveSource: () => mockActiveSource},
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({
      downloadAsync: () => Promise.resolve(),
      get localUri() {
        return mockLocalUri;
      },
      uri: 'assets_reciterimages_bundled',
    }),
  },
}));

jest.mock('@/utils/reciterImageLookup', () => ({
  getLocalReciterImage: (name: string) =>
    name === 'Bundled Reciter' ? 42 : undefined,
}));

import {lockScreenService} from '../LockScreenService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';

const setMain = (state: object) =>
  (usePlayerStore as unknown as {setState: (s: object) => void}).setState(
    state,
  );
const setMushaf = (state: object) =>
  (useMushafPlayerStore as unknown as {setState: (s: object) => void}).setState(
    state,
  );

function track(id: string, artwork?: string, reciterName = 'Test Reciter') {
  return {id, title: `Track ${id}`, artist: reciterName, reciterName, artwork};
}

const flush = () => new Promise<void>(r => setTimeout(r, 0));

const mainActivations = () =>
  mockMainPlayer.setActiveForLockScreen.mock.calls.map(
    ([, metadata]) => metadata as {title: string; artworkUrl?: string},
  );

beforeEach(async () => {
  mockMushafPlayer = {
    setActiveForLockScreen: jest.fn(),
    updateLockScreenMetadata: jest.fn(),
    clearLockScreenControls: jest.fn(),
  };
  mockActiveSource = 'none';
  mockLocalUri = 'file:///cache/reciter.png';
  setMain({queue: {tracks: [], currentIndex: 0}, playback: {state: 'paused'}});
  setMushaf({
    playbackState: 'idle',
    currentSurah: 0,
    currentVerseKey: null,
    currentVerseLabel: null,
    numberingMode: null,
  });
  await lockScreenService.startSync();
  jest.clearAllMocks();
});

afterEach(() => {
  lockScreenService.stopSync();
});

describe('verse audio and the lock screen', () => {
  it('takes the lock screen when it plays', () => {
    setMain({queue: {tracks: [track('a')], currentIndex: 0}});
    setMushaf({
      playbackState: 'playing',
      currentSurah: 2,
      numberingMode: 'hafs',
      currentVerseKey: '2:5',
      currentVerseLabel: '2:5',
    });

    expect(mockMushafPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(mockMushafPlayer.setActiveForLockScreen.mock.calls[0][1]).toEqual({
      title: 'Al-Baqarah · 2:5',
      artist: 'Test Reciter',
    });
    // The main player's entry goes, so its buttons cannot start a surah
    // over the verse audio.
    expect(mockMainPlayer.clearLockScreenControls).toHaveBeenCalled();
  });

  it('claims it once per player, and again for the next surah’s player', () => {
    setMushaf({
      playbackState: 'playing',
      currentSurah: 2,
      numberingMode: 'hafs',
      currentVerseKey: '2:5',
      currentVerseLabel: '2:5',
    });
    setMushaf({currentVerseKey: '2:6', currentVerseLabel: '2:6'});
    const first = mockMushafPlayer;
    expect(first.setActiveForLockScreen).toHaveBeenCalledTimes(1);

    // The next surah gets a new player.
    mockMushafPlayer = {
      setActiveForLockScreen: jest.fn(),
      updateLockScreenMetadata: jest.fn(),
      clearLockScreenControls: jest.fn(),
    };
    setMushaf({
      playbackState: 'playing',
      currentSurah: 3,
      currentVerseKey: '3:1',
      currentVerseLabel: '3:1',
    });

    expect(first.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(mockMushafPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);
  });

  it('gives the lock screen back when the main player plays, without a Stop', () => {
    setMain({queue: {tracks: [track('a')], currentIndex: 0}});
    setMushaf({playbackState: 'playing', currentSurah: 2});
    // Starting a surah pauses the verse audio; it does not make it idle.
    setMushaf({playbackState: 'paused'});
    mockMainPlayer.setActiveForLockScreen.mockClear();

    mockActiveSource = 'main';
    setMain({
      queue: {tracks: [track('b')], currentIndex: 0},
      playback: {state: 'playing'},
    });
    expect(mainActivations().map(m => m.title)).toEqual(['Track b']);

    // And it keeps following the main player's tracks from here on.
    setMain({queue: {tracks: [track('c')], currentIndex: 0}});
    expect(mainActivations().map(m => m.title)).toEqual(['Track b', 'Track c']);
  });

  it('keeps the lock screen while the main player is only paused', () => {
    setMain({queue: {tracks: [track('a')], currentIndex: 0}});
    setMushaf({playbackState: 'playing', currentSurah: 2});
    mockMainPlayer.setActiveForLockScreen.mockClear();

    mockActiveSource = 'mushaf';
    setMain({queue: {tracks: [track('b')], currentIndex: 0}});

    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });
});

describe('main player artwork', () => {
  it('passes a remote photo through', () => {
    setMain({
      queue: {
        tracks: [track('a', 'https://cdn.example.com/reciter.jpg')],
        currentIndex: 0,
      },
    });

    expect(mainActivations()[0].artworkUrl).toBe(
      'https://cdn.example.com/reciter.jpg',
    );
  });

  it('never hands over a value that is not a loadable url', () => {
    // Android reads the field as a java.net.URL and rejects the whole call
    // for these, which left no lock screen controls at all.
    for (const artwork of [
      'assets_reciterimages_someone',
      'data:image/png;base64,AAAA',
      '',
    ]) {
      mockMainPlayer.setActiveForLockScreen.mockClear();
      setMain({
        queue: {
          tracks: [track(`t-${artwork.length}`, artwork, 'No Photo')],
          currentIndex: 0,
        },
      });
      const [metadata] = mainActivations();
      expect(metadata.title).toBeDefined();
      expect('artworkUrl' in metadata).toBe(false);
    }
  });

  it('adds a bundled photo once it has been copied to a file', async () => {
    setMain({
      queue: {
        tracks: [track('a', 'assets_reciterimages_bundled', 'Bundled Reciter')],
        currentIndex: 0,
      },
    });
    expect('artworkUrl' in mainActivations()[0]).toBe(false);

    await flush();

    expect(mockMainPlayer.updateLockScreenMetadata).toHaveBeenCalledWith(
      expect.objectContaining({artworkUrl: 'file:///cache/reciter.png'}),
    );
  });

  it('still sets up the controls when the call is rejected with artwork', () => {
    mockMainPlayer.setActiveForLockScreen.mockImplementationOnce(() => {
      throw new Error('Cannot cast to URL');
    });
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    setMain({
      queue: {
        tracks: [track('a', 'https://cdn.example.com/reciter.jpg')],
        currentIndex: 0,
      },
    });

    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(2);
    expect(mainActivations()[1]).toEqual({
      title: 'Track a',
      artist: 'Test Reciter',
    });
    warn.mockRestore();
  });
});
