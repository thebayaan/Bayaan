/**
 * SheetGestures.tsx reads the sheet's drag gesture from a context that
 * react-native-actions-sheet does not export (dist/src/context), and takes
 * the gesture's handler tag from the ref it finds there. Every other test
 * mocks that context. This one runs the installed package's own sheet and
 * Gesture Handler (native modules and animations stubbed), so a package
 * update that moves the context or changes what its ref holds fails here
 * instead of quietly leaving sheet lists competing with the drag again.
 */
import 'react-native-gesture-handler/jestSetup';
import React, {act} from 'react';
import {ScrollView, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

// Just enough of Reanimated for the sheet to render; nothing animates.
jest.mock('react-native-reanimated', () => {
  const {View} = jest.requireActual('react-native');
  const ease = (t: number) => t;
  return {
    __esModule: true,
    default: {View, createAnimatedComponent: (component: unknown) => component},
    Easing: {ease, in: () => ease, out: () => ease, inOut: () => ease},
    runOnJS: (fn: unknown) => fn,
    runOnUI: (fn: unknown) => fn,
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: unknown) => ({
      value,
      addListener: () => undefined,
      removeListener: () => undefined,
    }),
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown, _config: unknown, done?: () => void) => {
      done?.();
      return value;
    },
    // What Gesture Handler's detector reads from Reanimated.
    useEvent: () => () => undefined,
    useHandler: () => ({doDependenciesDiffer: false, context: {}}),
    useComposedEventHandler: () => () => undefined,
    isSharedValue: () => false,
    setGestureState: () => undefined,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 47, bottom: 34, left: 0, right: 0}),
}));

import ActionSheet, {type ActionSheetRef} from 'react-native-actions-sheet';
import {usePanGestureContext} from 'react-native-actions-sheet/dist/src/context';
import {SheetScrollView} from '@/components/sheets/SheetGestures';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => mounted.splice(0).forEach(renderer => renderer.unmount()));
});

it('gives a ref outside a sheet, holding no gesture', () => {
  let found: ReturnType<typeof usePanGestureContext> | undefined;
  function Probe() {
    found = usePanGestureContext();
    return null;
  }
  act(() => {
    mounted.push(TestRenderer.create(<Probe />));
  });
  expect(found?.ref).toEqual({current: null});
});

it("hands a sheet's lists the sheet's drag gesture, with its handler tag", async () => {
  const sheet = React.createRef<ActionSheetRef>();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <ActionSheet ref={sheet} gestureEnabled>
        <SheetScrollView>
          <Text>content</Text>
        </SheetScrollView>
      </ActionSheet>,
    );
  });
  mounted.push(renderer);
  await act(async () => {
    sheet.current?.show();
  });
  // The sheet lays out once it is on screen and draws again, as it does on
  // a phone.
  const layout = {nativeEvent: {layout: {x: 0, y: 0, width: 390, height: 844}}};
  await act(async () => {
    for (const node of renderer.root.findAll(
      n => typeof n.props.onLayout === 'function',
    )) {
      node.props.onLayout(layout);
    }
  });

  const scrollViewType: unknown = ScrollView;
  const [list] = renderer.root.findAll(n => n.type === scrollViewType);
  expect(list).toBeDefined();
  // At the top the list runs along with the sheet's drag...
  const [drag] = list.props.simultaneousHandlers as {
    current: {handlerTag?: unknown} | null;
  }[];
  const tag = drag?.current?.handlerTag;
  expect(typeof tag).toBe('number');
  expect(tag).toBeGreaterThan(0);
  expect(list.props.blocksHandlers).toEqual([]);

  // ...and once scrolled the drag waits for it, by that same tag.
  await act(async () => {
    list.props.onScroll({nativeEvent: {contentOffset: {x: 0, y: 120}}});
  });
  const [scrolled] = renderer.root.findAll(n => n.type === scrollViewType);
  expect(scrolled.props.simultaneousHandlers).toEqual([]);
  expect(scrolled.props.blocksHandlers).toEqual([tag]);
});
