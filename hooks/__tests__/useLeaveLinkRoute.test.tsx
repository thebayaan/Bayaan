import React from 'react';
import {act, create} from 'react-test-renderer';

const mockNavigation = {
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
}));

import {useLeaveLinkRoute} from '@/hooks/useLeaveLinkRoute';

function Probe({onLeft}: {onLeft?: () => void}): null {
  useLeaveLinkRoute(onLeft);
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigation.canGoBack.mockReturnValue(true);
  mockNavigation.goBack.mockClear();
  mockNavigation.dispatch.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

function nextFrame(): void {
  act(() => {
    jest.advanceTimersByTime(32);
  });
}

it('steps off the root stack once, a frame after mounting, then calls onLeft', async () => {
  const onLeft = jest.fn();
  let renderer: ReturnType<typeof create> | null = null;
  await act(async () => {
    renderer = create(<Probe onLeft={onLeft} />);
  });
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  nextFrame();
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(onLeft).toHaveBeenCalledTimes(1);
  await act(async () => {
    renderer?.update(<Probe onLeft={onLeft} />);
  });
  nextFrame();
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(onLeft).toHaveBeenCalledTimes(1);
});

it('replaces itself with the tabs when nothing is underneath', async () => {
  mockNavigation.canGoBack.mockReturnValue(false);
  await act(async () => {
    create(<Probe />);
  });
  nextFrame();
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockNavigation.dispatch).toHaveBeenCalledWith({
    type: 'REPLACE',
    payload: {name: '(tabs)'},
  });
});

it('does nothing if it unmounts before the frame', async () => {
  let renderer: ReturnType<typeof create> | null = null;
  await act(async () => {
    renderer = create(<Probe />);
  });
  await act(async () => {
    renderer?.unmount();
  });
  nextFrame();
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
});
