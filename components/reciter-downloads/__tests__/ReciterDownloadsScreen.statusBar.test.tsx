// @ai-generated
/**
 * The reciter downloads screen forced a light-content status bar over the
 * theme background, which hid the clock and battery in light mode. It must
 * leave the themed status bar from the tabs layout alone. The route lives in
 * app/, so its test lives here.
 */
import React from 'react';
import {StatusBar} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({reciterId: 'r1'}),
}));

jest.mock('@/components/reciter-downloads/ReciterDownloadsList', () => ({
  ReciterDownloadsList: () => null,
}));

import ReciterDownloadsScreen from '@/app/(tabs)/(c.collection)/collection/reciter-downloads/[reciterId]';

it('does not override the themed status bar', () => {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    tree = TestRenderer.create(<ReciterDownloadsScreen />);
  });
  const bars = tree!.root.findAll(node => (node.type as unknown) === StatusBar);
  expect(bars).toHaveLength(0);
});
