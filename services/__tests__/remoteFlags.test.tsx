// @ai-generated
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {
  connectRemoteFlags,
  resetRemoteFlags,
  SETTLE_MS,
  useRemoteFlag,
  type RemoteFlagSource,
} from '../remoteFlags';

function fakeSource(initial?: boolean | string) {
  let value = initial;
  const listeners = new Set<() => void>();
  const source: RemoteFlagSource = {
    getFeatureFlag: () => value,
    onFeatureFlags: callback => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  return {
    source,
    load(next: boolean | string) {
      value = next;
      listeners.forEach(listener => listener());
    },
  };
}

let seen: boolean[] = [];
function Probe() {
  seen.push(useRemoteFlag('homeRedesign', false));
  return null;
}

function mount(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<Probe />);
  });
  return renderer;
}

const last = () => seen[seen.length - 1];

beforeEach(() => {
  jest.useFakeTimers();
  resetRemoteFlags();
  seen = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useRemoteFlag', () => {
  it('reads a flag that is already known', () => {
    connectRemoteFlags(fakeSource(true).source);
    mount();
    expect(last()).toBe(true);
  });

  it('takes flags that arrive soon after launch', () => {
    const flags = fakeSource();
    mount();
    expect(last()).toBe(false);
    act(() => connectRemoteFlags(flags.source));
    act(() => flags.load(true));
    expect(last()).toBe(true);
  });

  it('holds the fallback once the launch has settled', () => {
    const flags = fakeSource();
    mount();
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    act(() => connectRemoteFlags(flags.source));
    act(() => flags.load(true));
    expect(last()).toBe(false);
  });

  it('never changes mid-launch once settled', () => {
    const flags = fakeSource(true);
    connectRemoteFlags(flags.source);
    const renderer = mount();
    act(() => flags.load(false));
    expect(last()).toBe(true);
    // A screen mounted later this launch agrees.
    act(() => renderer.unmount());
    mount();
    expect(last()).toBe(true);
  });

  it('treats the control variant as off', () => {
    connectRemoteFlags(fakeSource('control').source);
    mount();
    expect(last()).toBe(false);
  });
});
