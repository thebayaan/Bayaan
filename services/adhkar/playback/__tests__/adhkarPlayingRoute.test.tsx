// app/adhkar-playing.tsx (tests cannot live under app/: expo-router would
// treat them as routes).
import React from 'react';
import {act, create} from 'react-test-renderer';

const mockNavigation = {
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};
const mockContainer = {dispatch: jest.fn()};
let mockFinishRestore: () => void = () => undefined;
const mockWait = jest.fn(
  (_timeoutMs: number) =>
    new Promise<void>(resolve => {
      mockFinishRestore = resolve;
    }),
);
const mockOpen = jest.fn<boolean, [unknown, unknown]>();

jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
  useNavigationContainerRef: () => mockContainer,
}));
jest.mock('@/services/adhkar/playback/sessionPersistence', () => ({
  waitForSessionRestore: (timeoutMs: number) => mockWait(timeoutMs),
}));
jest.mock('@/services/adhkar/playback/openPlayingDhikr', () => ({
  ...jest.requireActual('@/services/adhkar/playback/openPlayingDhikr'),
  openPlayingDhikr: (navigation: unknown, current: unknown) =>
    mockOpen(navigation, current),
}));

import AdhkarPlayingRoute from '@/app/adhkar-playing';

// The route navigates a frame after the restore settles.
function nextFrame(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 50));
}
import {adhkarStackAction} from '@/services/adhkar/playback/openPlayingDhikr';

beforeEach(() => {
  mockContainer.dispatch.mockClear();
  mockNavigation.canGoBack.mockReturnValue(true);
  mockNavigation.goBack.mockClear();
  mockNavigation.dispatch.mockClear();
  mockWait.mockClear();
  mockOpen.mockReset();
});

it('waits for the saved session, then opens the playing dhikr', async () => {
  mockOpen.mockReturnValue(true);
  await act(async () => {
    create(<AdhkarPlayingRoute />);
  });
  expect(mockWait).toHaveBeenCalledWith(3000);
  expect(mockOpen).not.toHaveBeenCalled();
  await act(async () => {
    mockFinishRestore();
    await nextFrame();
  });
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(mockOpen).toHaveBeenCalledWith(mockContainer, null);
  expect(mockContainer.dispatch).not.toHaveBeenCalled();
});

it('swaps itself for the tabs when it is the only route', async () => {
  mockOpen.mockReturnValue(true);
  mockNavigation.canGoBack.mockReturnValue(false);
  await act(async () => {
    create(<AdhkarPlayingRoute />);
  });
  await act(async () => {
    mockFinishRestore();
    await nextFrame();
  });
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockNavigation.dispatch).toHaveBeenCalledWith({
    type: 'REPLACE',
    payload: {name: '(tabs)'},
  });
});

it('falls back to the Adhkar screen when no session comes back', async () => {
  mockOpen.mockReturnValue(false);
  await act(async () => {
    create(<AdhkarPlayingRoute />);
  });
  await act(async () => {
    mockFinishRestore();
    await nextFrame();
  });
  expect(mockContainer.dispatch).toHaveBeenCalledWith(
    adhkarStackAction([{name: 'index', params: {}}]),
  );
});

it('does not navigate after it unmounts', async () => {
  mockOpen.mockReturnValue(false);
  let renderer: ReturnType<typeof create> | null = null;
  await act(async () => {
    renderer = create(<AdhkarPlayingRoute />);
  });
  await act(async () => {
    renderer?.unmount();
  });
  await act(async () => {
    mockFinishRestore();
    await nextFrame();
  });
  expect(mockOpen).not.toHaveBeenCalled();
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockContainer.dispatch).not.toHaveBeenCalled();
});
