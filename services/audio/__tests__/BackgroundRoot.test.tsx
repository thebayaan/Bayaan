// @ai-generated
import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';

const mockBootApp = jest.fn(() => Promise.resolve());
let mockPhoneMounted = false;
const mockPhoneListeners = new Set<() => void>();

jest.mock('@/services/appBoot', () => ({bootApp: () => mockBootApp()}));
jest.mock('@/services/audio/ExpoAudioProvider', () => {
  const {Text} = jest.requireActual('react-native');
  return {
    ExpoAudioProvider: () => <Text>provider</Text>,
    isPhoneProviderMounted: () => mockPhoneMounted,
    subscribePhoneProvider: (listener: () => void) => {
      mockPhoneListeners.add(listener);
      return () => mockPhoneListeners.delete(listener);
    },
  };
});

import {
  BackgroundRoot,
  resetBackgroundRootsForTests,
} from '@/services/audio/BackgroundRoot';

function setPhoneMounted(mounted: boolean): void {
  mockPhoneMounted = mounted;
  mockPhoneListeners.forEach(listener => listener());
}

function providers(r: ReactTestRenderer | undefined): number {
  return r?.toJSON() ? 1 : 0;
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  act(() => resetBackgroundRootsForTests());
  mockPhoneMounted = false;
});

it('lets only the first background root own the player', async () => {
  const stop = jest.fn();
  const sync = jest.fn(() => stop);
  let car: ReactTestRenderer | undefined;
  let widget: ReactTestRenderer | undefined;
  await act(async () => {
    car = create(<BackgroundRoot id="car" startWidgetSync={sync} />);
  });
  await act(async () => {
    widget = create(<BackgroundRoot id="widget" startWidgetSync={sync} />);
  });
  await flush();
  expect(providers(car)).toBe(1);
  expect(providers(widget)).toBe(0);
  expect(sync).toHaveBeenCalledTimes(1);

  // The car root goes away; the widget root takes over.
  await act(async () => car?.unmount());
  await flush();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(providers(widget)).toBe(1);
  expect(sync).toHaveBeenCalledTimes(2);
  await act(async () => widget?.unmount());
});

it('steps aside for the phone layout and stops its widget sync', async () => {
  const stop = jest.fn();
  const sync = jest.fn(() => stop);
  let widget: ReactTestRenderer | undefined;
  await act(async () => {
    widget = create(<BackgroundRoot id="widget" startWidgetSync={sync} />);
  });
  await flush();
  expect(sync).toHaveBeenCalledTimes(1);

  await act(async () => setPhoneMounted(true));
  expect(providers(widget)).toBe(0);
  expect(stop).toHaveBeenCalledTimes(1);
  await act(async () => widget?.unmount());
});

it('starts widget sync only after the app has booted', async () => {
  let resolveBoot: () => void = () => undefined;
  mockBootApp.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        resolveBoot = resolve;
      }),
  );
  const sync = jest.fn(() => jest.fn());
  let widget: ReactTestRenderer | undefined;
  await act(async () => {
    widget = create(<BackgroundRoot id="widget" startWidgetSync={sync} />);
  });
  expect(sync).not.toHaveBeenCalled();
  await act(async () => resolveBoot());
  await flush();
  expect(sync).toHaveBeenCalledTimes(1);
  await act(async () => widget?.unmount());
});
