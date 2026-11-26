// Runs Gesture Handler's own (legacy) ScrollView and NativeViewGestureHandler,
// and its long press, with only its native module replaced, to check what
// reaches the native side: the relations the sheet's drag gesture and its
// content end up with, and the footer's claim.
import React from 'react';
import {ScrollView, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

type Relations = {
  waitFor?: number[];
  simultaneousHandlers?: number[];
  blocksHandlers?: number[];
};

const mockNative = {
  created: new Map<number, string>(),
  relations: new Map<number, Relations>(),
  configs: new Map<number, Record<string, unknown>>(),
};

function mockGestureModule() {
  const noop = () => undefined;
  const setConfig = (tag: number, config: Record<string, unknown>) => {
    mockNative.configs.set(tag, {...mockNative.configs.get(tag), ...config});
  };
  return {
    __esModule: true,
    default: {
      createGestureHandler: (
        name: string,
        tag: number,
        config: Record<string, unknown>,
      ) => {
        mockNative.created.set(tag, name);
        setConfig(tag, config);
      },
      configureRelations: (tag: number, relations: Relations) => {
        mockNative.relations.set(tag, relations);
      },
      attachGestureHandler: noop,
      dropGestureHandler: noop,
      setGestureHandlerConfig: setConfig,
      updateGestureHandlerConfig: setConfig,
      flushOperations: noop,
      install: noop,
      installUIRuntimeBindings: () => true,
    },
  };
}
jest.mock('react-native-gesture-handler/src/RNGestureHandlerModule', () =>
  mockGestureModule(),
);
jest.mock(
  'react-native-gesture-handler/lib/module/RNGestureHandlerModule',
  () => mockGestureModule(),
);

// The sheet's drag gesture, as the sheet keeps it once attached.
const SHEET_DRAG_TAG = 4100;
const mockSheet = {ref: {current: {handlerTag: SHEET_DRAG_TAG}}};
jest.mock('react-native-actions-sheet/dist/src/context', () => ({
  usePanGestureContext: () => ({ref: mockSheet.ref, eventManager: {}}),
}));

import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {
  SheetFooter,
  SheetNoDrag,
  SheetScrollView,
} from '@/components/sheets/SheetGestures';

/** Relations of the one native-view handler these tests create. */
function nativeViewRelations(): Relations | undefined {
  const tags = [...mockNative.created]
    .filter(([, name]) => name === 'NativeViewGestureHandler')
    .map(([tag]) => tag);
  expect(tags).toHaveLength(1);
  return mockNative.relations.get(tags[0]);
}

async function flush() {
  // Gesture Handler resolves refs and sends relations in microtasks.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const mounted: TestRenderer.ReactTestRenderer[] = [];

async function render(element: React.JSX.Element) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  mounted.push(renderer);
  await flush();
  return renderer;
}

beforeEach(() => {
  mockNative.created.clear();
  mockNative.relations.clear();
  mockNative.configs.clear();
});

afterEach(async () => {
  await act(async () => mounted.splice(0).forEach(r => r.unmount()));
});

it('runs a sheet scroll view with the sheet drag at the top, and makes the drag wait once scrolled', async () => {
  const renderer = await render(
    <SheetScrollView>
      <Text>content</Text>
    </SheetScrollView>,
  );
  expect(nativeViewRelations()).toMatchObject({
    simultaneousHandlers: [SHEET_DRAG_TAG],
    blocksHandlers: [],
  });

  const scrollViewType: unknown = ScrollView;
  const [scrollView] = renderer.root.findAll(
    node => node.type === scrollViewType,
  );
  await act(async () => {
    scrollView.props.onScroll({nativeEvent: {contentOffset: {x: 0, y: 200}}});
  });
  await flush();
  expect(nativeViewRelations()).toMatchObject({
    simultaneousHandlers: [],
    blocksHandlers: [SHEET_DRAG_TAG],
  });

  await act(async () => {
    scrollView.props.onScroll({nativeEvent: {contentOffset: {x: 0, y: 0}}});
  });
  await flush();
  expect(nativeViewRelations()).toMatchObject({
    simultaneousHandlers: [SHEET_DRAG_TAG],
    blocksHandlers: [],
  });
});

it('makes the sheet drag wait for touches on a no-drag area', async () => {
  await render(
    <SheetNoDrag>
      <Text>Next</Text>
    </SheetNoDrag>,
  );
  const relations = nativeViewRelations();
  expect(relations?.blocksHandlers).toEqual([SHEET_DRAG_TAG]);
  expect(relations?.simultaneousHandlers ?? []).toEqual([]);
});

it('claims a footer touch as the finger lands and leaves the press to fire', async () => {
  await render(
    <GestureHandlerRootView>
      <SheetFooter>
        <Text>Play</Text>
      </SheetFooter>
    </GestureHandlerRootView>,
  );
  const claims = [...mockNative.created].filter(
    ([, name]) => name === 'LongPressGestureHandler',
  );
  expect(claims).toHaveLength(1);
  const [tag] = claims[0];
  expect(mockNative.configs.get(tag)).toMatchObject({
    minDurationMs: 0,
    maxDist: 1e6,
    shouldCancelWhenOutside: false,
    cancelsJSResponder: false,
    cancelsTouchesInView: false,
  });
  // Nothing lets the sheet's drag run along with the claim.
  const relations = mockNative.relations.get(tag);
  expect(relations?.simultaneousHandlers ?? []).not.toContain(SHEET_DRAG_TAG);
});
