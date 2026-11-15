// @ai-generated
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {AppState, type AppStateStatus} from 'react-native';
import {usePlayerStore} from '../playerStore';
import {useProgress, useProgressStore} from '../progressStore';

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
  getState: () => {playback: {position: number; duration: number}};
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
    store.setState(s => ({
      playback: {...s.playback, position, duration, buffering: false},
    }));
  });
}

let shown: {position: number; duration: number}[] = [];
function Probe() {
  const {position, duration} = useProgress();
  shown.push({position, duration});
  return null;
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

beforeEach(() => {
  appState.currentState = 'active';
  useProgressStore.setState({position: 0, duration: 0, seekPosition: null});
  tick(10);
  shown = [];
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  (AppState.addEventListener as jest.Mock).mockClear();
});

const last = () => shown[shown.length - 1];

describe('useProgress', () => {
  it('follows the player store while the app is in the foreground', () => {
    expect(last()).toEqual({position: 10, duration: 600});
    tick(12);
    expect(last()).toEqual({position: 12, duration: 600});
  });

  it('holds position and duration in the background; the store stays live', () => {
    changeAppState('background');
    const renders = shown.length;
    tick(14, 600);
    tick(16, 700); // a new track in the background
    tick(18, 700);
    expect(shown.length).toBe(renders);
    expect(last()).toEqual({position: 10, duration: 600});
    expect(store.getState().playback).toMatchObject({
      position: 18,
      duration: 700,
    });
  });

  it('shows the live values on return', () => {
    changeAppState('background');
    tick(40, 700);
    changeAppState('active');
    expect(last()).toEqual({position: 40, duration: 700});
  });

  it('keeps updating while inactive (iOS Control Center)', () => {
    changeAppState('inactive');
    tick(20);
    expect(last()).toEqual({position: 20, duration: 600});
  });

  it('does not render for playback fields it does not show', () => {
    const renders = shown.length;
    act(() => {
      store.setState(s => ({playback: {...s.playback, buffering: true}}));
    });
    act(() => {
      store.setState(s => ({playback: {...s.playback, state: 'paused'}}));
    });
    expect(shown.length).toBe(renders);
  });
});
