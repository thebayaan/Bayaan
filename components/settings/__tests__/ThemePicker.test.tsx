// @ai-generated
// The picker only records the choice. Telling the native side which look to
// use is the theme store's job: when the picker did it too, it pinned Light
// every time System was chosen, and the app stayed light until a restart.
import React from 'react';
import {Appearance, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

jest.mock('@/components/Icons', () => new Proxy({}, {get: () => () => null}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {Light: 'light'},
}));

import {useThemeStore} from '@/store/themeStore';
import {ThemePicker} from '../ThemePicker';

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render() {
  let created!: TestRenderer.ReactTestRenderer;
  act(() => {
    created = TestRenderer.create(<ThemePicker />);
  });
  renderer = created;
  return created;
}

/** The option whose label is `label`. */
const option = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      n
        .findAll(c => (c.type as unknown) === Text)
        .some(c => c.props.children === label),
  )[0];

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.restoreAllMocks();
});

describe('ThemePicker', () => {
  it('choosing System only removes the pinned look', () => {
    act(() => useThemeStore.getState().setThemeMode('light'));
    const r = render();
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme');

    act(() => option(r, 'Auto').props.onPress());

    expect(useThemeStore.getState().themeMode).toBe('system');
    expect(setColorScheme.mock.calls).toEqual([['unspecified']]);
  });

  it('choosing Dark pins dark, once', () => {
    act(() => useThemeStore.getState().setThemeMode('system'));
    const r = render();
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme');

    act(() => option(r, 'Dark').props.onPress());

    expect(useThemeStore.getState().themeMode).toBe('dark');
    expect(useThemeStore.getState().theme.isDarkMode).toBe(true);
    expect(setColorScheme.mock.calls).toEqual([['dark']]);
  });

  it('does nothing when the active option is tapped again', () => {
    act(() => useThemeStore.getState().setThemeMode('dark'));
    const r = render();
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme');

    act(() => option(r, 'Dark').props.onPress());

    expect(setColorScheme).not.toHaveBeenCalled();
  });
});
