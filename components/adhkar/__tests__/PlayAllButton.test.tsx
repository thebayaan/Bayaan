import React from 'react';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {PlayAllButton} from '@/components/adhkar/PlayAllButton';
import type {PlayAllState} from '@/services/adhkar/playback/sessionReducer';

// Uses the app's English resources from test-utils/setupI18n.ts.
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#111111', textSecondary: '#666666'},
      fonts: {medium: 'Medium'},
    },
  }),
}));
jest.mock('@/components/Icons', () => ({
  PlayIcon: () => null,
  PauseIcon: () => null,
}));

let mounted: ReactTestRenderer | undefined;

function render(state: PlayAllState, onPress = jest.fn()): ReactTestRenderer {
  act(() => {
    mounted = TestRenderer.create(
      <PlayAllButton onPress={onPress} state={state} />,
    );
  });
  if (!mounted) throw new Error('not rendered');
  return mounted;
}

function label(r: ReactTestRenderer): string {
  return r.root
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => [n.props.children].flat().join(''))
    .join('');
}

function a11yLabel(r: ReactTestRenderer): string {
  return r.root.findByProps({accessibilityRole: 'button'}).props
    .accessibilityLabel;
}

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
});

it('reads Play All with no session for the list', () => {
  const r = render('idle');
  expect(label(r)).toBe('Play All');
  expect(a11yLabel(r)).toBe('Play all');
});

it('reads Pause while the list plays', () => {
  const r = render('playing');
  expect(label(r)).toBe('Pause');
  expect(a11yLabel(r)).toBe('Pause all');
});

it('reads Resume while the list is paused', () => {
  const r = render('paused');
  expect(label(r)).toBe('Resume');
  expect(a11yLabel(r)).toBe('Resume all');
});

it('calls onPress', () => {
  const onPress = jest.fn();
  const r = render('paused', onPress);
  act(() => {
    r.root.findByProps({accessibilityRole: 'button'}).props.onPress();
  });
  expect(onPress).toHaveBeenCalledTimes(1);
});
