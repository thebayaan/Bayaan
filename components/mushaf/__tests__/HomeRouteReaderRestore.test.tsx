// @ai-generated
/**
 * RFC-023 step 5: the home route draws nothing while the root layout holds it,
 * under a reader that the launch restores. When the hold ends is the root
 * layout's rule (RootLayoutReaderRestore.test.tsx). Lives outside app/ because
 * every file there is bundled as a route.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockReciters = {renders: 0};

jest.mock('@/components/RecitersView', () => ({
  __esModule: true,
  default: () => {
    mockReciters.renders += 1;
    return null;
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({push: jest.fn()}),
  useNavigation: () => ({setOptions: jest.fn()}),
}));
jest.mock('@/data/reciterData', () => ({}));

import HomeScreen from '@/app/(tabs)/(a.home)/index';
import {HomeHeldContext} from '@/services/mushaf/readerRestoreState';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

function renderHome(held: boolean): void {
  const tree = (
    <HomeHeldContext.Provider value={held}>
      <HomeScreen />
    </HomeHeldContext.Provider>
  );
  act(() => {
    if (renderer) renderer.update(tree);
    else renderer = TestRenderer.create(tree);
  });
}

beforeEach(() => {
  mockReciters.renders = 0;
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
});

it('renders at once when nothing holds it', () => {
  renderHome(false);
  expect(mockReciters.renders).toBe(1);
});

it('draws nothing while held, and renders when the hold ends', () => {
  renderHome(true);
  expect(mockReciters.renders).toBe(0);
  renderHome(false);
  expect(mockReciters.renders).toBe(1);
});
