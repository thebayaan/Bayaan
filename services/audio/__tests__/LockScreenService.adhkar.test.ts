/**
 * Adhkar lock screen entry: metadata, artwork, activation, hand-off to and
 * from the Quran and mushaf players.
 */

const mockMainPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};
const mockMushafPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};
const adhkarPlayer = {
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
  setLockScreenTrackControls: jest.fn(),
};

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      queue: {
        tracks: [{id: 't1', title: 'Al-Fatihah', artist: 'Reciter'}],
        currentIndex: 0,
      },
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

let mockActiveSource = 'adhkar';
jest.mock('../AudioCoordinator', () => ({
  audioCoordinator: {getActiveSource: () => mockActiveSource},
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, o?: {current: number; total: number}) =>
      key === 'home:adhkar.position' && o
        ? `${o.current} of ${o.total}`
        : key === 'settings:credits.items.alafasyTitle'
          ? 'Mishary Rashid Alafasy'
          : key,
  },
}));

const mockCachedArtwork = jest.fn<string | undefined, [string]>();
const mockLoadArtwork = jest.fn<Promise<string | null>, [string]>();
jest.mock('@/services/adhkar/playback/adhkarArtwork', () => ({
  cachedAdhkarArtworkUri: (listId: string) => mockCachedArtwork(listId),
  loadAdhkarArtworkUri: (listId: string) => mockLoadArtwork(listId),
}));

jest.mock('@/config/branding', () => ({
  __esModule: true,
  default: {appName: 'Bayaan'},
}));

import {
  adhkarLockScreenMetadata,
  adhkarLockScreenTitle,
  lockScreenService,
} from '../LockScreenService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import type {AudioPlayer} from 'expo-audio';
import {Platform} from 'react-native';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

const session: AdhkarSession = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items: Array.from({length: 23}, (_, i) => ({
    dhikrId: String(i),
    audioFile: `${i}.mp3`,
    playable: true,
    preview: '',
  })),
  index: 3,
  mode: 'all',
  loop: false,
  status: 'playing',
  error: false,
  trackToken: 1,
  positionSec: 0,
  lastActiveAt: 0,
};

// The mock player is structural; the service only uses these methods.
const asPlayer = (p: typeof adhkarPlayer): AudioPlayer =>
  p as unknown as AudioPlayer;

// The mocked stores hold a trimmed state (a track with three fields), which
// the real store types reject; these tests only need setState.
type SettableStore = {setState: (s: object) => void};
const playerStore = usePlayerStore as unknown as SettableStore;
const mushafStore = useMushafPlayerStore as unknown as SettableStore;

const track = (id: string) => ({
  queue: {tracks: [{id, title: id, artist: 'Reciter'}], currentIndex: 0},
});

beforeEach(async () => {
  [mockMainPlayer, mockMushafPlayer, adhkarPlayer].forEach(p =>
    Object.values(p).forEach(fn => fn.mockClear()),
  );
  mockActiveSource = 'adhkar';
  mockCachedArtwork.mockReset().mockReturnValue(undefined);
  mockLoadArtwork.mockReset().mockResolvedValue(null);
  mushafStore.setState({playbackState: 'idle'});
  playerStore.setState({...track('t1'), playback: {state: 'paused'}});
  await lockScreenService.startSync();
  Object.values(mockMainPlayer).forEach(fn => fn.mockClear());
});

afterEach(() => {
  lockScreenService.stopSync();
  lockScreenService.setCarMode(false);
  lockScreenService.setCarAyahLabel(null);
});

describe('adhkarLockScreenTitle', () => {
  it('builds "Morning Adhkar · 4 of 23"', () => {
    expect(adhkarLockScreenTitle(session, (c, t) => `${c} of ${t}`)).toBe(
      'Morning Adhkar · 4 of 23',
    );
  });
});

describe('adhkarLockScreenMetadata', () => {
  const labels = {
    position: (c: number, t: number) => `${c} of ${t}`,
    alafasy: 'Mishary Rashid Alafasy',
    appName: 'Bayaan',
  };

  it('credits Alafasy on the lists he recites, with the list as album', () => {
    expect(adhkarLockScreenMetadata(session, labels)).toEqual({
      title: 'Morning Adhkar · 4 of 23',
      artist: 'Mishary Rashid Alafasy',
      albumTitle: 'Morning Adhkar',
    });
    for (const listId of ['evening-adhkar', 'quranic-duas']) {
      expect(
        adhkarLockScreenMetadata({...session, listId}, labels).artist,
      ).toBe('Mishary Rashid Alafasy');
    }
  });

  it('shows the app name for other lists and Saved', () => {
    for (const listId of ['travel', 'saved']) {
      expect(
        adhkarLockScreenMetadata({...session, listId}, labels).artist,
      ).toBe('Bayaan');
    }
  });

  it('adds the artwork only when it is known', () => {
    expect(
      adhkarLockScreenMetadata(session, labels, 'file:///a.png'),
    ).toHaveProperty('artworkUrl', 'file:///a.png');
    expect(adhkarLockScreenMetadata(session, labels)).not.toHaveProperty(
      'artworkUrl',
    );
  });
});

const morningMetadata = {
  title: 'Morning Adhkar · 4 of 23',
  artist: 'Mishary Rashid Alafasy',
  albumTitle: 'Morning Adhkar',
};

// Lets the artwork promise chain run.
const flush = (): Promise<void> => new Promise(r => setImmediate(r));

describe('activateAdhkar', () => {
  it('activates the adhkar player and clears main and mushaf', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      morningMetadata,
      {
        showSeekForward: false,
        showSeekBackward: false,
        trackControls: {previous: true, next: true},
      },
    );
    expect(mockMainPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMushafPlayer.clearLockScreenControls).toHaveBeenCalled();
  });

  it('only updates metadata when the same player is already active', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), {
      ...session,
      index: 4,
    });
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(adhkarPlayer.updateLockScreenMetadata).toHaveBeenCalledWith({
      ...morningMetadata,
      title: 'Morning Adhkar · 5 of 23',
    });
  });

  it('adds the list artwork once it resolves', async () => {
    mockLoadArtwork.mockResolvedValue('file:///morning.png');
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    expect(mockLoadArtwork).toHaveBeenCalledWith('morning-adhkar');
    await flush();
    expect(adhkarPlayer.updateLockScreenMetadata).toHaveBeenCalledWith({
      ...morningMetadata,
      artworkUrl: 'file:///morning.png',
    });
  });

  it('passes cached artwork straight through without loading again', () => {
    mockCachedArtwork.mockReturnValue('file:///morning.png');
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      {...morningMetadata, artworkUrl: 'file:///morning.png'},
      expect.anything(),
    );
    expect(mockLoadArtwork).not.toHaveBeenCalled();
  });

  it('drops late artwork once the entry is gone', async () => {
    mockLoadArtwork.mockResolvedValue('file:///morning.png');
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    await flush();
    expect(adhkarPlayer.updateLockScreenMetadata).not.toHaveBeenCalled();
  });

  it('drops late artwork for a list that is no longer playing', async () => {
    mockLoadArtwork.mockResolvedValue('file:///morning.png');
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockLoadArtwork.mockReturnValue(new Promise(() => {}));
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), {
      ...session,
      listId: 'travel',
      listTitle: 'Travel',
    });
    adhkarPlayer.updateLockScreenMetadata.mockClear();
    await flush();
    expect(adhkarPlayer.updateLockScreenMetadata).not.toHaveBeenCalled();
  });

  it('does not re-activate main on a main track change while held', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    playerStore.setState(track('t2'));
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });

  it('keeps the entry while main still reads playing right after adhkarWillPlay', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    playerStore.setState({...track('t2'), playback: {state: 'playing'}});
    expect(adhkarPlayer.clearLockScreenControls).not.toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });

  it('drops the held entry once the main player plays a new track', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockActiveSource = 'main';
    playerStore.setState({...track('t2'), playback: {state: 'playing'}});
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalled();
  });

  it('drops the held entry when the mushaf starts playing', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    adhkarPlayer.clearLockScreenControls.mockClear();
    mockActiveSource = 'mushaf';
    mushafStore.setState({playbackState: 'playing'});
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
  });

  it('drops the held entry when a paused mushaf resumes', () => {
    // Mushaf played, adhkarWillPlay paused it (not idle), adhkar took over.
    mushafStore.setState({playbackState: 'playing'});
    mushafStore.setState({playbackState: 'paused'});
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    adhkarPlayer.clearLockScreenControls.mockClear();
    mockActiveSource = 'mushaf';
    mushafStore.setState({playbackState: 'playing'});
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
  });

  it('does not restore main when a paused mushaf goes idle while held', () => {
    mushafStore.setState({playbackState: 'playing'});
    mushafStore.setState({playbackState: 'paused'});
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    mushafStore.setState({playbackState: 'idle'});
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
    // The entry is still held: the next track only updates metadata.
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), {
      ...session,
      index: 4,
    });
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(adhkarPlayer.updateLockScreenMetadata).toHaveBeenCalledTimes(1);
  });

  it('re-activates fully after the entry was dropped', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockActiveSource = 'main';
    playerStore.setState({...track('t2'), playback: {state: 'playing'}});
    mockActiveSource = 'adhkar';
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(2);
  });

  it('leaves car mode and the car ayah label off the main player while held', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    lockScreenService.setCarMode(true);
    lockScreenService.setCarAyahLabel('Ayah 3 of 7');
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
    expect(mockMainPlayer.updateLockScreenMetadata).not.toHaveBeenCalled();
    // Main picks both up when the entry is cleared.
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.objectContaining({artist: 'Reciter · Ayah 3 of 7'}),
      {showSeekForward: false, showSeekBackward: false},
    );
  });
});

describe('adhkar track controls', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('opts in on activation, disabling previous on the first dhikr', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), {
      ...session,
      index: 0,
    });
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.anything(),
      expect.objectContaining({trackControls: {previous: false, next: true}}),
    );
  });

  it('activates without them in single mode', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), {
      ...session,
      mode: 'single',
    });
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.anything(),
      {showSeekForward: false, showSeekBackward: false},
    );
    expect(lockScreenService.hasAdhkarTrackControls()).toBe(false);
  });

  it('updates them in place only when they change', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), {
      ...session,
      index: 4,
    });
    expect(adhkarPlayer.setLockScreenTrackControls).not.toHaveBeenCalled();
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), {
      ...session,
      index: 22,
    });
    expect(adhkarPlayer.setLockScreenTrackControls).toHaveBeenCalledWith({
      previous: true,
      next: false,
    });
  });

  it('hands them to CarPlay on iOS while a car is connected, and back', () => {
    Platform.OS = 'ios';
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    lockScreenService.setCarMode(true);
    expect(adhkarPlayer.setLockScreenTrackControls).toHaveBeenLastCalledWith(
      null,
    );
    expect(lockScreenService.hasAdhkarTrackControls()).toBe(false);
    lockScreenService.setCarMode(false);
    expect(adhkarPlayer.setLockScreenTrackControls).toHaveBeenLastCalledWith({
      previous: true,
      next: true,
    });
  });

  it('keeps them on Android while a car is connected', () => {
    Platform.OS = 'android';
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    lockScreenService.setCarMode(true);
    expect(adhkarPlayer.setLockScreenTrackControls).not.toHaveBeenCalled();
    expect(lockScreenService.hasAdhkarTrackControls()).toBe(true);
  });

  it('reports the held entry until it is cleared', () => {
    expect(lockScreenService.isAdhkarHeld()).toBe(false);
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    expect(lockScreenService.isAdhkarHeld()).toBe(true);
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(lockScreenService.isAdhkarHeld()).toBe(false);
    expect(lockScreenService.hasAdhkarTrackControls()).toBe(false);
  });

  it('never gives the Quran player track controls', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.anything(),
      {showSeekForward: true, showSeekBackward: true},
    );
  });
});

describe('clearAdhkar', () => {
  it('clears the adhkar player and restores the main player', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockMainPlayer.setActiveForLockScreen.mockClear();
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.objectContaining({title: 't1'}),
      expect.anything(),
    );
  });

  it('is a no-op when the entry already went to another source', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mockActiveSource = 'mushaf';
    mushafStore.setState({playbackState: 'playing'});
    adhkarPlayer.clearLockScreenControls.mockClear();
    mockMainPlayer.setActiveForLockScreen.mockClear();
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(adhkarPlayer.clearLockScreenControls).not.toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });

  it('does not restore main over a playing mushaf', () => {
    // A held entry the mushaf did not drop: adhkar re-activated while the
    // mushaf store still read playing.
    mushafStore.setState({playbackState: 'playing'});
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    mushafStore.setState({playbackState: 'loading'});
    mockMainPlayer.setActiveForLockScreen.mockClear();
    lockScreenService.clearAdhkar(asPlayer(adhkarPlayer));
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(mockMainPlayer.setActiveForLockScreen).not.toHaveBeenCalled();
  });
});

describe('stopSync', () => {
  it('clears a held adhkar entry', () => {
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    lockScreenService.stopSync();
    expect(adhkarPlayer.clearLockScreenControls).toHaveBeenCalled();
    // After a restart the entry activates fully again.
    lockScreenService.activateAdhkar(asPlayer(adhkarPlayer), session);
    expect(adhkarPlayer.setActiveForLockScreen).toHaveBeenCalledTimes(2);
  });
});
