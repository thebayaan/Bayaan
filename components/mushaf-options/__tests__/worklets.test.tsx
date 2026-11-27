// @ai-generated
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

/**
 * Animated styles run on the UI thread. Calling a plain JS function there
 * is fatal in a Release build (the app closes without a crash report), so
 * every function an animated style captures must itself be a worklet. The
 * Reanimated Babel plugin records what a worklet captures in `__closure`;
 * this mock checks it for every animated style the sheet builds.
 */

const mockOffenders: string[] = [];

function mockIsWorklet(value: unknown): boolean {
  return (
    typeof value === 'function' &&
    '__workletHash' in value &&
    value.__workletHash !== undefined
  );
}

function mockCheckClosure(updater: unknown, where: string): void {
  if (typeof updater !== 'function' || !('__closure' in updater)) {
    mockOffenders.push(`${where}: not a worklet`);
    return;
  }
  const closure: unknown = updater.__closure;
  if (typeof closure !== 'object' || closure === null) return;
  for (const [name, value] of Object.entries(closure)) {
    if (typeof value === 'function' && !mockIsWorklet(value)) {
      mockOffenders.push(`${where}: captures non-worklet function ${name}`);
    }
  }
}

jest.mock('react-native-reanimated', () => {
  const {View: MockView} = jest.requireActual('react-native');
  const actualEasing = jest.requireActual(
    'react-native-reanimated/lib/module/Easing',
  ).Easing;
  const identity = (value: unknown) => value;
  return {
    __esModule: true,
    default: {View: MockView},
    Easing: actualEasing,
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (updater: unknown) => {
      mockCheckClosure(updater, 'useAnimatedStyle');
      return {};
    },
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({value}),
    withRepeat: identity,
    withSpring: identity,
    withTiming: identity,
  };
});
jest.mock('react-native-worklets', () => ({
  runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', background: '#ffffff'},
      typography: {smallSize: 12, mediumSize: 14, subheadingSize: 18},
    },
  }),
}));

import {TileArt, type TileArtKind} from '../TileArt';
import {ReaderLayoutTransition} from '../ReaderLayoutTransition';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const KINDS: TileArtKind[] = [
  'mushaf',
  'list',
  'single',
  'book',
  'scroll',
  'pages',
  'continuous',
];

beforeEach(() => {
  mockOffenders.length = 0;
});

it.each(KINDS)('the %s tile animates with worklets only', kind => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<TileArt kind={kind} selected />);
  });
  expect(mockOffenders).toEqual([]);
  act(() => renderer.unmount());
});

it('the page entrance animates with worklets only', () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ReaderLayoutTransition layout="single" background="#ffffff">
        {null}
      </ReaderLayoutTransition>,
    );
  });
  expect(mockOffenders).toEqual([]);
  act(() => renderer.unmount());
});
