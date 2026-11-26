// @ai-generated
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {AppState, type AppStateStatus} from 'react-native';
import {usePlayerStore} from '../playerStore';
import {useShownPlaybackTime} from '../progressStore';

jest.mock('../playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      playback: {state: 'playing', position: 0, duration: 0, buffering: false},
    })),
  };
});

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const store = usePlayerStore as unknown as {
  setState: (fn: (s: {playback: object}) => object) => void;
};
const appState = AppState as unknown as {currentState: AppStateStatus};

function changeAppState(next: AppStateStatus) {
  act(() => {
    appState.currentState = next;
    (AppState.addEventListener as jest.Mock).mock.calls
      .filter(([type]) => type === 'change')
      .forEach(([, listener]) => listener(next));
  });
}

/** One provider tick: what ExpoAudioProvider writes every 2 s on Android. */
function tick(position: number, duration = 600) {
  act(() => {
    store.setState(s => ({playback: {...s.playback, position, duration}}));
  });
}

let shown: {position: number; duration: number}[] = [];
function Probe() {
  shown.push(useShownPlaybackTime());
  return null;
}

let renderer: TestRenderer.ReactTestRenderer | null = null;
function mount() {
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
}

beforeEach(() => {
  appState.currentState = 'active';
  tick(10);
  shown = [];
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  (AppState.addEventListener as jest.Mock).mockClear();
});

const last = () => shown[shown.length - 1];

describe('useShownPlaybackTime', () => {
  it('follows the player store in the foreground', () => {
    mount();
    expect(last()).toEqual({position: 10, duration: 600});
    tick(12, 700);
    expect(last()).toEqual({position: 12, duration: 700});
  });

  it('holds the shown values in the background, with no render', () => {
    mount();
    tick(20);
    changeAppState('background');
    const renders = shown.length;
    tick(22);
    tick(24, 700);
    expect(shown.length).toBe(renders);
    expect(last()).toEqual({position: 20, duration: 600});
  });

  it('shows the live values on return', () => {
    mount();
    changeAppState('background');
    tick(40, 700);
    changeAppState('active');
    expect(last()).toEqual({position: 40, duration: 700});
    tick(42, 700);
    expect(last()).toEqual({position: 42, duration: 700});
  });

  it('keeps following while inactive (iOS Control Center)', () => {
    mount();
    changeAppState('inactive');
    tick(30);
    expect(last()).toEqual({position: 30, duration: 600});
  });

  it('starts from the live values when it mounts in the background', () => {
    appState.currentState = 'background';
    tick(50, 650);
    mount();
    expect(last()).toEqual({position: 50, duration: 650});
    const renders = shown.length;
    tick(52, 650);
    expect(shown.length).toBe(renders);
    expect(last()).toEqual({position: 50, duration: 650});
  });
});
