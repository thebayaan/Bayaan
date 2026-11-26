// @ai-start
import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import {NavigationContext} from 'expo-router/react-navigation';
import {useScreenFocusEffect} from '../useScreenFocusEffect';

type Listener = () => void;
type Navigation = NonNullable<React.ContextType<typeof NavigationContext>>;

const nav = {
  focused: true,
  listeners: {focus: new Set<Listener>(), blur: new Set<Listener>()},
};

const navigation = {
  isFocused: () => nav.focused,
  addListener: (event: 'focus' | 'blur', listener: Listener) => {
    nav.listeners[event].add(listener);
    return () => nav.listeners[event].delete(listener);
  },
} as unknown as Navigation;

function fire(event: 'focus' | 'blur'): void {
  nav.focused = event === 'focus';
  act(() => {
    nav.listeners[event].forEach(listener => listener());
  });
}

const started = jest.fn();
const stopped = jest.fn();
const effect = () => {
  started();
  return () => stopped();
};

function Probe() {
  useScreenFocusEffect(effect);
  return null;
}

let tree: ReactTestRenderer;

function mount(inScreen = true): void {
  act(() => {
    tree = create(
      inScreen ? (
        <NavigationContext.Provider value={navigation}>
          <Probe />
        </NavigationContext.Provider>
      ) : (
        <Probe />
      ),
    );
  });
}

beforeEach(() => {
  nav.focused = true;
  nav.listeners.focus.clear();
  nav.listeners.blur.clear();
  started.mockClear();
  stopped.mockClear();
});

describe('useScreenFocusEffect', () => {
  it('stops on blur and starts again on focus', () => {
    mount();
    expect(started).toHaveBeenCalledTimes(1);
    fire('blur');
    expect(stopped).toHaveBeenCalledTimes(1);
    fire('focus');
    expect(started).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
    expect(stopped).toHaveBeenCalledTimes(2);
    expect(nav.listeners.focus.size).toBe(0);
    expect(nav.listeners.blur.size).toBe(0);
  });

  it('does not start on a screen that mounts blurred', () => {
    nav.focused = false;
    mount();
    expect(started).not.toHaveBeenCalled();
    act(() => tree.unmount());
    expect(stopped).not.toHaveBeenCalled();
  });

  it('runs a second focus event only once', () => {
    mount();
    fire('focus');
    expect(started).toHaveBeenCalledTimes(1);
  });

  it('runs like useEffect outside a screen', () => {
    mount(false);
    expect(started).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    expect(stopped).toHaveBeenCalledTimes(1);
  });
});
// @ai-end
