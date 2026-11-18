// @ai-generated
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {AppState, type AppStateStatus} from 'react-native';
import {useAppForeground} from '../useAppForeground';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const addEventListener = AppState.addEventListener as jest.Mock;
const appState = AppState as unknown as {currentState: AppStateStatus};

/** What React Native does on a change: the state first, then the listeners. */
function changeAppState(next: AppStateStatus) {
  act(() => {
    appState.currentState = next;
    addEventListener.mock.calls
      .filter(([type]) => type === 'change')
      .forEach(([, listener]) => listener(next));
  });
}

let seen: boolean[] = [];
function Probe() {
  seen.push(useAppForeground());
  return null;
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

beforeEach(() => {
  addEventListener.mockClear();
  appState.currentState = 'active';
  seen = [];
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('useAppForeground', () => {
  it('is true while active and false in the background', () => {
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
    expect(seen).toEqual([true]);
    changeAppState('background');
    changeAppState('active');
    expect(seen).toEqual([true, false, true]);
  });

  it('stays true while inactive (iOS Control Center), with no render', () => {
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
    changeAppState('inactive');
    changeAppState('active');
    expect(seen).toEqual([true]);
  });

  it('starts false when the app is already in the background', () => {
    appState.currentState = 'background';
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
    expect(seen).toEqual([false]);
  });

  it('removes its listener on unmount', () => {
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
    const subscription = addEventListener.mock.results[0].value as {
      remove: jest.Mock;
    };
    act(() => renderer?.unmount());
    renderer = null;
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });
});
