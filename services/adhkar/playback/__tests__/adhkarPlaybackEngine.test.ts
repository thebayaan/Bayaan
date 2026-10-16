import {AppState} from 'react-native';
import {
  startAdhkarPlaybackEngine,
  resetAdhkarEngineForTests,
} from '@/services/adhkar/playback/adhkarPlaybackEngine';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {SessionSource} from '@/services/adhkar/playback/types';

jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));

type Listener = (s: {
  playing: boolean;
  didJustFinish: boolean;
  isLoaded: boolean;
  currentTime: number;
  duration: number;
}) => void;

type TrackListener = (e: {command: 'next' | 'previous'}) => void;
type ListenerArgs =
  | ['playbackStatusUpdate', Listener]
  | ['lockScreenTrackCommand', TrackListener];

function fakePlayer() {
  let listener: Listener | null = null;
  let trackListener: TrackListener | null = null;
  return {
    loop: false,
    currentTime: 0,
    duration: 10,
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    addListener: jest.fn((...args: ListenerArgs) => {
      if (args[0] === 'lockScreenTrackCommand') {
        const t = args[1];
        trackListener = t;
        return {
          remove: jest.fn(() => {
            if (trackListener === t) trackListener = null;
          }),
        };
      }
      const l = args[1];
      listener = l;
      return {
        remove: jest.fn(() => {
          if (listener === l) listener = null;
        }),
      };
    }),
    pressTrack(command: 'next' | 'previous') {
      trackListener?.({command});
    },
    emit(s: Partial<Parameters<Listener>[0]>) {
      listener?.({
        playing: false,
        didJustFinish: false,
        isLoaded: true,
        currentTime: 0,
        duration: 10,
        ...s,
      });
    },
  };
}

const src: SessionSource = {
  listId: 'morning-adhkar',
  listTitle: 'Morning',
  items: ['a', 'b'].map(id => ({
    dhikrId: id,
    audioFile: `${id}.mp3`,
    playable: true,
    preview: id,
  })),
};

let player: ReturnType<typeof fakePlayer>;
let stop: () => void;
const coordinator = {
  adhkarWillPlay: jest.fn(),
  sourceDidStop: jest.fn(),
  getActiveSource: jest.fn(() => 'adhkar'),
};
const lockScreen = {activate: jest.fn(), clear: jest.fn()};

const appRemove = jest.fn();
let appStateSpy: jest.SpyInstance;

function lastAppStateHandler(): (state: string) => void {
  const calls = appStateSpy.mock.calls;
  return calls[calls.length - 1][1];
}

beforeEach(() => {
  jest.useFakeTimers();
  appStateSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({remove: appRemove});
  resetAdhkarEngineForTests();
  coordinator.getActiveSource.mockReturnValue('adhkar');
  useAdhkarSessionStore.setState({session: null, revealToken: 0});
  player = fakePlayer();
  stop = startAdhkarPlaybackEngine({
    createPlayer: () => player,
    getSource: file => (file ? 1 : null),
    coordinator,
    lockScreen,
  });
});
afterEach(() => {
  stop();
  appStateSpy.mockRestore();
  jest.useRealTimers();
  jest.clearAllMocks();
});

const dispatch = useAdhkarSessionStore.getState().dispatch;

it('loads, plays and confirms through the player status', () => {
  dispatch({type: 'pressPlayAll', source: src});
  expect(player.replace).toHaveBeenCalledTimes(1);
  expect(player.play).toHaveBeenCalledTimes(1);
  expect(coordinator.adhkarWillPlay).toHaveBeenCalled();
  player.emit({playing: true});
  expect(useAdhkarSessionStore.getState().session?.status).toBe('playing');
});

it('advances on finish with the same player, no second player', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({playing: false, didJustFinish: true});
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
  expect(player.replace).toHaveBeenCalledTimes(2);
  player.emit({playing: true});
  expect(lockScreen.activate).toHaveBeenCalledTimes(2);
});

it('ignores a finish carried over from the previous clip', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({didJustFinish: true}); // advance to b
  player.emit({didJustFinish: true}); // stale, b has not reported playing yet
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
});

it('advances after a clip shorter than two seconds', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true, duration: 1.2});
  player.emit({didJustFinish: true, duration: 1.2});
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
});

it('retries once, then pauses with an error', () => {
  dispatch({type: 'pressPlayAll', source: src});
  jest.advanceTimersByTime(1500);
  expect(player.play).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(1500);
  expect(useAdhkarSessionStore.getState().session).toMatchObject({
    status: 'paused',
    error: true,
  });
});

it('follows a remote pause and resume without re-playing', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({playing: false});
  expect(useAdhkarSessionStore.getState().session?.status).toBe('paused');
  expect(player.play).toHaveBeenCalledTimes(1);
  player.emit({playing: true});
  expect(useAdhkarSessionStore.getState().session?.status).toBe('playing');
});

it('saves the player position into the session on pause', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.currentTime = 4;
  dispatch({type: 'toggle'});
  expect(player.pause).toHaveBeenCalled();
  expect(useAdhkarSessionStore.getState().session?.positionSec).toBe(4);
});

it('restored sessions do not load until play, then seek', () => {
  dispatch({
    type: 'restored',
    session: {
      ...src,
      index: 1,
      mode: 'all',
      loop: false,
      status: 'paused',
      error: false,
      trackToken: 1,
      positionSec: 3,
      lastActiveAt: 0,
    },
  });
  expect(player.replace).not.toHaveBeenCalled();
  dispatch({type: 'toggle'});
  expect(player.replace).toHaveBeenCalledTimes(1);
  expect(player.seekTo).toHaveBeenCalledWith(3);
});

it('pauses the player and clears the lock screen when the session ends', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  dispatch({type: 'stop'});
  expect(player.pause).toHaveBeenCalled();
  expect(lockScreen.clear).toHaveBeenCalled();
  expect(coordinator.sourceDidStop).toHaveBeenCalledWith('adhkar');
});

it('sets loop in single mode only', () => {
  dispatch({type: 'pressCard', source: src, index: 0});
  dispatch({type: 'toggleLoop'});
  expect(player.loop).toBe(true);
});

it('keeps loop off in all mode', () => {
  dispatch({type: 'pressPlayAll', source: src});
  dispatch({type: 'toggleLoop'});
  expect(player.loop).toBe(false);
});

it('does not clear the lock screen on a remote pause', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.emit({playing: false});
  expect(lockScreen.clear).not.toHaveBeenCalled();
});

it('clears the lock screen when another source took over', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  coordinator.getActiveSource.mockReturnValue('main');
  dispatch({type: 'otherAudioStarted'});
  expect(lockScreen.clear).toHaveBeenCalled();
});

describe('a playing update that lands after another source took over', () => {
  // The update was sent before the engine's pause reached the player. Acting
  // on it would pause the Quran the user just started.
  function takenOver(): void {
    dispatch({type: 'pressPlayAll', source: src});
    player.emit({playing: true});
    coordinator.getActiveSource.mockReturnValue('main');
    dispatch({type: 'otherAudioStarted'});
    coordinator.adhkarWillPlay.mockClear();
    player.pause.mockClear();
  }

  it('is not taken as a remote resume', () => {
    takenOver();
    player.emit({playing: true});
    expect(coordinator.adhkarWillPlay).not.toHaveBeenCalled();
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(useAdhkarSessionStore.getState().session?.status).toBe('paused');
  });

  it('does not play the current dhikr from a stale clip either', () => {
    takenOver();
    dispatch({type: 'swipedTo', listId: src.listId, dhikrId: 'b'});
    player.emit({playing: true});
    expect(coordinator.adhkarWillPlay).not.toHaveBeenCalled();
    expect(player.replace).toHaveBeenCalledTimes(1);
    expect(useAdhkarSessionStore.getState().session).toMatchObject({
      index: 1,
      status: 'paused',
    });
  });

  it('is a remote resume again once adhkar owns playback', () => {
    takenOver();
    coordinator.getActiveSource.mockReturnValue('adhkar');
    player.emit({playing: true});
    expect(coordinator.adhkarWillPlay).toHaveBeenCalled();
    expect(useAdhkarSessionStore.getState().session?.status).toBe('playing');
  });
});

it('does not write the previous clip time onto a dhikr swiped to while paused', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.currentTime = 4;
  dispatch({type: 'toggle'});
  expect(useAdhkarSessionStore.getState().session?.positionSec).toBe(4);
  dispatch({type: 'swipedTo', listId: src.listId, dhikrId: 'b'});
  expect(useAdhkarSessionStore.getState().session?.positionSec).toBe(0);
  const handler = lastAppStateHandler();
  handler('background');
  expect(useAdhkarSessionStore.getState().session?.positionSec).toBe(0);
});

it('reuses one player across an engine restart and re-attaches the listener', () => {
  const create = jest.fn(() => player);
  stop();
  const deps = {
    getSource: (f: string | null) => (f ? 1 : null),
    coordinator,
    lockScreen,
  };
  stop = startAdhkarPlaybackEngine({...deps, createPlayer: create});
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  const oldSubscription = player.addListener.mock.results[0].value;
  stop();
  stop = startAdhkarPlaybackEngine({...deps, createPlayer: create});
  expect(create).toHaveBeenCalledTimes(1);
  expect(oldSubscription.remove).toHaveBeenCalled();
  player.emit({playing: false, didJustFinish: true});
  expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
});

it('saves the position when the app goes to the background', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  player.currentTime = 6;
  lastAppStateHandler()('background');
  expect(useAdhkarSessionStore.getState().session?.positionSec).toBe(6);
  stop();
  expect(appRemove).toHaveBeenCalled();
});

it('re-activates the lock screen on a resume of the same track', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  expect(lockScreen.activate).toHaveBeenCalledTimes(1);
  dispatch({type: 'toggle'});
  // Paused: the lock screen service may drop the entry when Quran plays.
  dispatch({type: 'toggle'});
  player.emit({playing: true});
  expect(lockScreen.activate).toHaveBeenCalledTimes(2);
});

it('re-activates the lock screen when the engine restarts mid-playback', () => {
  dispatch({type: 'pressPlayAll', source: src});
  player.emit({playing: true});
  stop();
  lockScreen.activate.mockClear();
  stop = startAdhkarPlaybackEngine({
    createPlayer: () => player,
    getSource: file => (file ? 1 : null),
    coordinator,
    lockScreen,
  });
  expect(lockScreen.activate).toHaveBeenCalledTimes(1);
  expect(player.play).toHaveBeenCalledTimes(1);
});

describe('swiping while paused', () => {
  function pausedOnB(): void {
    dispatch({type: 'pressPlayAll', source: src});
    player.emit({playing: true});
    dispatch({type: 'toggle'});
    dispatch({type: 'swipedTo', listId: src.listId, dhikrId: 'b'});
  }

  it('drops the old clip and moves the lock screen entry to the new dhikr', () => {
    pausedOnB();
    expect(lockScreen.activate).toHaveBeenLastCalledWith(
      player,
      expect.objectContaining({index: 1, status: 'paused'}),
    );
    // Play from the app loads the new dhikr instead of resuming the old clip.
    dispatch({type: 'toggle'});
    expect(player.replace).toHaveBeenCalledTimes(2);
  });

  it('clears the lock screen entry when another source took over', () => {
    dispatch({type: 'pressPlayAll', source: src});
    player.emit({playing: true});
    coordinator.getActiveSource.mockReturnValue('main');
    dispatch({type: 'otherAudioStarted'});
    lockScreen.clear.mockClear();
    lockScreen.activate.mockClear();
    dispatch({type: 'swipedTo', listId: src.listId, dhikrId: 'b'});
    // Already cleared on takeover: nothing to move.
    expect(lockScreen.activate).not.toHaveBeenCalled();
  });

  it('a remote play of the stale clip is stopped and plays the current dhikr', () => {
    pausedOnB();
    player.pause.mockClear();
    coordinator.adhkarWillPlay.mockClear();
    // Lock screen play resumes the clip still loaded in the native player.
    player.emit({playing: true});
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.replace).toHaveBeenCalledTimes(2);
    expect(coordinator.adhkarWillPlay).toHaveBeenCalled();
    expect(useAdhkarSessionStore.getState().session).toMatchObject({
      index: 1,
      status: 'loading',
    });
    player.emit({playing: true});
    expect(useAdhkarSessionStore.getState().session?.status).toBe('playing');
  });
});

describe('restored position', () => {
  function restoreAt(positionSec: number): void {
    dispatch({
      type: 'restored',
      session: {
        ...src,
        index: 1,
        mode: 'all',
        loop: false,
        status: 'paused',
        error: false,
        trackToken: 1,
        positionSec,
        lastActiveAt: 0,
      },
    });
    dispatch({type: 'toggle'});
  }

  it('re-seeks once the clip loads when the early seek was dropped', () => {
    restoreAt(5);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
    player.emit({isLoaded: false, currentTime: 0});
    expect(player.seekTo).toHaveBeenCalledTimes(1);
    player.emit({isLoaded: true, playing: true, currentTime: 0});
    expect(player.seekTo).toHaveBeenCalledTimes(2);
    expect(player.seekTo).toHaveBeenLastCalledWith(5);
    player.emit({isLoaded: true, playing: true, currentTime: 0.2});
    expect(player.seekTo).toHaveBeenCalledTimes(2);
  });

  it('does not seek again when the early seek held', () => {
    restoreAt(5);
    player.emit({isLoaded: true, playing: true, currentTime: 5.1});
    expect(player.seekTo).toHaveBeenCalledTimes(1);
  });
});

describe('lock screen next / previous', () => {
  it('moves the session to the next and previous dhikr', () => {
    dispatch({type: 'pressPlayAll', source: src});
    player.emit({playing: true});
    player.pressTrack('next');
    expect(useAdhkarSessionStore.getState().session?.index).toBe(1);
    player.pressTrack('previous');
    expect(useAdhkarSessionStore.getState().session?.index).toBe(0);
  });

  it('does nothing past the ends or in single mode', () => {
    dispatch({type: 'pressPlayAll', source: src});
    player.pressTrack('previous');
    expect(useAdhkarSessionStore.getState().session?.index).toBe(0);
    dispatch({type: 'stop'});
    dispatch({type: 'pressCard', source: src, index: 0});
    player.pressTrack('next');
    expect(useAdhkarSessionStore.getState().session?.index).toBe(0);
  });

  it('stops listening when the engine stops', () => {
    dispatch({type: 'pressPlayAll', source: src});
    stop();
    player.pressTrack('next');
    expect(useAdhkarSessionStore.getState().session?.index).toBe(0);
    stop = () => {};
  });
});
