// @ai-generated
// The side insets MushafViewer (main.tsx) hands to the page layout.
//
// In phone landscape the page keeps clear of the left and right safe-area
// insets. On iOS they are the sensor housing. On Android they are the display
// cutout (a punch-hole camera) and, with button navigation, the navigation
// bar, which the edge-to-edge reader otherwise draws the text under.

import React, {act} from 'react';
import {Platform} from 'react-native';
import TestRenderer from 'react-test-renderer';
import MushafViewer from '../main';

const mockLayoutOpts: {sideInsets?: unknown}[] = [];

jest.mock('../constants', () => {
  const actual = jest.requireActual('../constants');
  return {
    ...actual,
    // Record what the reader asks for, then stop the render: the pages and
    // the chrome below need the Mushaf data and native modules.
    useMushafLayout: (opts: {sideInsets?: unknown}) => {
      mockLayoutOpts.push(opts);
      throw new Error('mock-stop-render');
    },
  };
});

// A punch-hole camera on the left in landscape, gesture navigation.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 21, left: 52, right: 0}),
}));

jest.mock('react-native-reanimated', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {View: MockView, createAnimatedComponent: (c: unknown) => c},
    useSharedValue: (v: number) => ({value: v}),
    useAnimatedStyle: () => ({}),
    withTiming: (v: number) => v,
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({back: jest.fn(), push: jest.fn()}),
  useNavigation: () => ({setOptions: jest.fn(), addListener: jest.fn()}),
}));
jest.mock('expo-router/react-navigation', () => ({useHeaderHeight: () => 0}));
jest.mock('@/hooks/useGlassProps', () => ({
  useGlassTint: () => undefined,
  USE_GLASS: false,
  useGlassColorScheme: () => 'light',
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {background: '#fff', text: '#111', border: '#ccc'}},
    isDarkMode: false,
  }),
}));

// Modules that load native code or fonts when they are imported.
jest.mock('expo-audio', () => ({}));
jest.mock('@shopify/react-native-skia', () => ({Skia: {}}));
jest.mock('../skia/SkiaPage', () => () => null);
jest.mock('../skia/ContinuousMushafView', () => () => null);
jest.mock('../qcf/QCFPage', () => () => null);
jest.mock('../reading/ReadingPageView', () => () => null);
jest.mock('../reading/ContinuousListView', () => () => null);
jest.mock('../MushafSearchView', () => () => null);
jest.mock('../MushafPlayerBar', () => ({MushafPlayerBar: () => null}));
jest.mock('../RecitationMicButton', () => ({
  useRecitationFollowAlong: jest.fn(),
}));
jest.mock('@/components/MushafSettingsContent', () => ({
  RewayahFallbackBanner: () => null,
}));

describe('MushafViewer — the side insets of the page', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['ios', 'android'] as const)('passes them on %s', os => {
    jest.replaceProperty(Platform, 'OS', os);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      act(() => {
        TestRenderer.create(<MushafViewer pageNumber={1} />);
      }),
    ).toThrow('mock-stop-render');

    expect(mockLayoutOpts.at(-1)?.sideInsets).toEqual({left: 52, right: 0});
  });
});
