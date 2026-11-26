/**
 * What sheet scroll views, footers and no-drag areas tell Gesture Handler
 * about the sheet's drag: at the top a list and the drag run together,
 * scrolled down the drag waits for the list, a footer claims its touches,
 * and a no-drag area always makes the drag wait.
 * SheetGestures.relations.test.tsx checks the same against Gesture
 * Handler's own handlers.
 */
import React from 'react';
import {Text, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

type Recorded = Record<string, unknown> & {children?: React.ReactNode};

const mockRendered: {
  scroll: Recorded[];
  list: Recorded[];
  noDrag: Recorded[];
  detector: Recorded[];
  claims: unknown[];
} = {scroll: [], list: [], noDrag: [], detector: [], claims: []};

jest.mock('react-native-gesture-handler', () => {
  const ReactActual = jest.requireActual('react');
  const record =
    (into: 'scroll' | 'list' | 'noDrag' | 'detector') => (props: Recorded) => {
      mockRendered[into].push(props);
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.children,
      );
    };
  return {
    LegacyScrollView: record('scroll'),
    LegacyFlatList: record('list'),
    NativeViewGestureHandler: record('noDrag'),
    GestureDetector: record('detector'),
    useLongPressGesture: (config: unknown) => {
      mockRendered.claims.push(config);
      return {claim: config};
    },
  };
});

// The sheet keeps its drag gesture in this ref; tag 7 once it exists.
const mockSheet: {ref: {current: {handlerTag: number} | null}} = {
  ref: {current: null},
};
jest.mock('react-native-actions-sheet/dist/src/context', () => ({
  usePanGestureContext: () => ({ref: mockSheet.ref, eventManager: {}}),
}));

import {
  FOOTER_CLAIM,
  SheetFlatList,
  SheetFooter,
  SheetNoDrag,
  SheetScrollView,
  TOP_SLOP,
} from '@/components/sheets/SheetGestures';

const SHEET_DRAG_TAG = 7;
const mounted: TestRenderer.ReactTestRenderer[] = [];

function render(element: React.JSX.Element) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  mounted.push(renderer);
  return renderer;
}

function scrollTo(props: Recorded | undefined, y: number) {
  const onScroll = props?.onScroll as (event: unknown) => void;
  act(() => {
    onScroll({nativeEvent: {contentOffset: {x: 0, y}}});
  });
}

function relations(props: Recorded | undefined) {
  return {
    simultaneousHandlers: props?.simultaneousHandlers,
    blocksHandlers: props?.blocksHandlers,
  };
}

beforeEach(() => {
  mockSheet.ref = {current: {handlerTag: SHEET_DRAG_TAG}};
  mockRendered.scroll.length = 0;
  mockRendered.list.length = 0;
  mockRendered.noDrag.length = 0;
  mockRendered.detector.length = 0;
  mockRendered.claims.length = 0;
});

afterEach(() => {
  act(() => mounted.splice(0).forEach(renderer => renderer.unmount()));
});

describe('SheetScrollView', () => {
  it('shares a touch with the sheet drag while scrolled to the top', () => {
    render(
      <SheetScrollView>
        <Text>content</Text>
      </SheetScrollView>,
    );
    expect(relations(mockRendered.scroll.at(-1))).toEqual({
      simultaneousHandlers: [mockSheet.ref],
      blocksHandlers: [],
    });
  });

  it('makes the sheet drag wait once scrolled down, and shares again at the top', () => {
    const onScroll = jest.fn();
    render(
      <SheetScrollView onScroll={onScroll}>
        <Text>content</Text>
      </SheetScrollView>,
    );

    scrollTo(mockRendered.scroll.at(-1), 120);
    expect(relations(mockRendered.scroll.at(-1))).toEqual({
      simultaneousHandlers: [],
      blocksHandlers: [SHEET_DRAG_TAG],
    });
    expect(onScroll).toHaveBeenCalledWith({
      nativeEvent: {contentOffset: {x: 0, y: 120}},
    });

    // Within a point of the top counts as the top.
    scrollTo(mockRendered.scroll.at(-1), TOP_SLOP);
    expect(relations(mockRendered.scroll.at(-1))).toEqual({
      simultaneousHandlers: [mockSheet.ref],
      blocksHandlers: [],
    });
    expect(onScroll).toHaveBeenCalledTimes(2);
  });

  it('never bounces, so a drag down at the top moves the sheet', () => {
    render(<SheetScrollView bounces={true} />);
    expect(mockRendered.scroll.at(-1)).toMatchObject({
      bounces: false,
      overScrollMode: 'never',
      scrollEventThrottle: 16,
    });

    // Scrolled down, Android shows its usual edge effect again.
    scrollTo(mockRendered.scroll.at(-1), 80);
    expect(mockRendered.scroll.at(-1)?.overScrollMode).toBeUndefined();
    expect(mockRendered.scroll.at(-1)?.bounces).toBe(false);
  });

  it('passes its ref and other props to the scroll view', () => {
    const ref = React.createRef<never>();
    const style = {flex: 1};
    render(
      <SheetScrollView
        ref={ref}
        style={style}
        keyboardShouldPersistTaps="handled"
      />,
    );
    expect(mockRendered.scroll.at(-1)).toMatchObject({
      ref,
      style,
      keyboardShouldPersistTaps: 'handled',
    });
  });

  it('waits for the sheet to make its drag gesture', () => {
    mockSheet.ref = {current: null};
    const renderer = render(<SheetScrollView />);
    expect(relations(mockRendered.scroll.at(-1))).toEqual({
      simultaneousHandlers: [],
      blocksHandlers: [],
    });

    // The sheet attaches its gesture; the next render picks it up.
    mockSheet.ref.current = {handlerTag: SHEET_DRAG_TAG};
    act(() => renderer.update(<SheetScrollView />));
    expect(relations(mockRendered.scroll.at(-1))).toEqual({
      simultaneousHandlers: [mockSheet.ref],
      blocksHandlers: [],
    });
  });

  it('is a plain scroll view outside a sheet', () => {
    mockSheet.ref = {current: null};
    render(<SheetScrollView />);
    scrollTo(mockRendered.scroll.at(-1), 300);
    expect(relations(mockRendered.scroll.at(-1))).toEqual({
      simultaneousHandlers: [],
      blocksHandlers: [],
    });
  });
});

describe('SheetFlatList', () => {
  it('shares touches with the sheet drag like SheetScrollView', () => {
    const data = ['a', 'b'];
    const renderItem = jest.fn();
    render(<SheetFlatList data={data} renderItem={renderItem} />);
    expect(mockRendered.list.at(-1)).toMatchObject({
      data,
      renderItem,
      bounces: false,
      overScrollMode: 'never',
      simultaneousHandlers: [mockSheet.ref],
      blocksHandlers: [],
    });

    scrollTo(mockRendered.list.at(-1), 48);
    expect(relations(mockRendered.list.at(-1))).toEqual({
      simultaneousHandlers: [],
      blocksHandlers: [SHEET_DRAG_TAG],
    });
    expect(mockRendered.list.at(-1)?.overScrollMode).toBeUndefined();
  });
});

describe('SheetFooter', () => {
  it('claims its touches as the finger lands, without cancelling the press', () => {
    const style = {paddingBottom: 38};
    const renderer = render(
      <SheetFooter style={style}>
        <Text>Play</Text>
      </SheetFooter>,
    );
    expect(mockRendered.claims).toEqual([FOOTER_CLAIM]);
    expect(mockRendered.detector.at(-1)?.gesture).toEqual({
      claim: FOOTER_CLAIM,
    });
    // Active with no hold time and held however far the finger wobbles, so
    // the sheet's drag cannot start for the touch...
    expect(FOOTER_CLAIM).toMatchObject({
      minDuration: 0,
      shouldCancelWhenOutside: false,
    });
    expect(FOOTER_CLAIM.maxDistance).toBeGreaterThanOrEqual(10000);
    // ...and the press under the finger still fires.
    expect(FOOTER_CLAIM).toMatchObject({
      cancelsJSResponder: false,
      cancelsTouchesInView: false,
    });

    const view: unknown = View;
    const [row] = renderer.root.findAll(node => node.type === view);
    expect(row?.props.style).toBe(style);
    expect(row?.props.children).toEqual(<Text>Play</Text>);
  });

  it('needs no sheet drag to claim (an iPad card or a plain screen)', () => {
    mockSheet.ref = {current: null};
    render(
      <SheetFooter>
        <Text>Start</Text>
      </SheetFooter>,
    );
    expect(mockRendered.claims).toEqual([FOOTER_CLAIM]);
    expect(mockRendered.noDrag).toEqual([]);
  });
});

describe('SheetNoDrag', () => {
  it('makes the sheet drag wait for touches on a nested list', () => {
    const style = {maxHeight: 240};
    const renderer = render(
      <SheetNoDrag style={style}>
        <Text>accordion list</Text>
      </SheetNoDrag>,
    );
    expect(mockRendered.noDrag.at(-1)?.blocksHandlers).toEqual([
      SHEET_DRAG_TAG,
    ]);
    const view: unknown = View;
    const [area] = renderer.root.findAll(node => node.type === view);
    expect(area?.props.style).toBe(style);
    expect(area?.props.children).toEqual(<Text>accordion list</Text>);
  });

  it('blocks nothing outside a sheet', () => {
    mockSheet.ref = {current: null};
    render(
      <SheetNoDrag>
        <Text>accordion list</Text>
      </SheetNoDrag>,
    );
    expect(mockRendered.noDrag.at(-1)?.blocksHandlers).toEqual([]);
  });
});
