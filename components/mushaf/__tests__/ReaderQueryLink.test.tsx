// @ai-generated
/**
 * A warm bayaan://mushaf?page=N with another screen over the open reader
 * (Translations, say). The link was a NAVIGATE to /mushaf, which the root
 * stack applies to a reader only when it is on top, so it pushed a second
 * reader. app/+native-intent.tsx now sends such a link through the link
 * route, which goes back to the open reader (ReaderLinkRedirect).
 *
 * This runs expo-router itself: the link arrives as an expo-linking 'url'
 * event, as on a device.
 */
import React, {act} from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';
import * as Linking from 'expo-linking';
import {router, Stack, useLocalSearchParams} from 'expo-router';
import {ExpoRoot} from 'expo-router/build/ExpoRoot';
import {navigationRef} from 'expo-router/build/global-state/navigationRef';
import {getMockContext} from 'expo-router/build/testing-library/mock-config';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let mockOpenUrl: ((url: string) => void) | null = null;
jest
  .spyOn(Linking, 'addEventListener')
  .mockImplementation((_type, listener) => {
    mockOpenUrl = url => listener({url});
    return {remove: () => undefined};
  });

function Reader(): React.ReactElement {
  const {page} = useLocalSearchParams<{page?: string}>();
  return <Text>{`reader page ${page}`}</Text>;
}

const routes = {
  _layout: () => <Stack />,
  index: () => <Text>Home</Text>,
  mushaf: Reader,
  'mushaf/[page]': require('../../../app/mushaf/[page]'),
  'quran/[surah]': require('../../../app/quran/[surah]'),
  translations: () => <Text>Translations</Text>,
  '+native-intent': require('../../../app/+native-intent'),
};

let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
  jest.useRealTimers();
});

async function settle(): Promise<void> {
  await act(async () => {
    await jest.runAllTimersAsync();
  });
}

async function openUrl(url: string): Promise<void> {
  if (!mockOpenUrl) throw new Error('no url listener');
  const open = mockOpenUrl;
  await act(async () => open(url));
  await settle();
}

type StackRoute = {name: string; params?: object};

/** The routes of the root layout's stack (under expo-router's own root). */
function stack(): StackRoute[] {
  const root = navigationRef.getRootState()?.routes[0];
  return (root?.state?.routes ?? []) as StackRoute[];
}

/** The reader open on page 50, under Translations. */
async function readerUnderTranslations(): Promise<void> {
  await act(async () => {
    renderer = TestRenderer.create(
      <ExpoRoot context={getMockContext(routes)} location="/" />,
    );
  });
  await act(async () => router.push('/mushaf?page=50'));
  await act(async () => router.push('/translations'));
  await settle();
  expect(stack().map(r => r.name)).toEqual(['index', 'mushaf', 'translations']);
}

it('mushaf?page=N goes back to the open reader, with the new page', async () => {
  await readerUnderTranslations();
  await openUrl('bayaan://mushaf?page=100');
  expect(stack().map(r => r.name)).toEqual(['index', 'mushaf']);
  expect(stack()[1].params).toEqual({page: '100'});
});

it('mushaf?surah=S&ayah=A goes back to the open reader too', async () => {
  await readerUnderTranslations();
  await openUrl('bayaan://mushaf?surah=2&ayah=255');
  expect(stack().map(r => r.name)).toEqual(['index', 'mushaf']);
  expect(stack()[1].params).toEqual({
    surah: '2',
    ayah: '255',
  });
});

it('a query link with other params stays a navigate', async () => {
  await readerUnderTranslations();
  await openUrl('bayaan://mushaf?page=100&anchor=2:255');
  expect(stack().map(r => r.name)).toEqual([
    'index',
    'mushaf',
    'translations',
    'mushaf',
  ]);
});

it('with the reader on top, one reader stays, with the new page', async () => {
  await readerUnderTranslations();
  await act(async () => router.back());
  await settle();
  await openUrl('bayaan://mushaf?page=100');
  expect(stack().map(r => r.name)).toEqual(['index', 'mushaf']);
  expect(stack()[1].params).toEqual({page: '100'});
});

it('leaves a cold link as it is, and keeps the host of an App Link', () => {
  const {redirectSystemPath} = routes['+native-intent'];
  const cold = 'bayaan://mushaf?page=50';
  expect(redirectSystemPath({path: cold, initial: true})).toBe(cold);
  expect(
    redirectSystemPath({
      path: 'https://example.com/mushaf?page=50',
      initial: false,
    }),
  ).toBe('https://example.com/mushaf/50');
});
