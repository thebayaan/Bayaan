/**
 * The verse sheet's lists and footers (sheetGestures.tsx): the sheets' own
 * SheetScrollView and SheetFooter. Its footers claim every touch the moment
 * the finger lands, which keeps the sheet's drag from starting for that
 * touch, and never cancel the press under the finger, so a tap on Previous,
 * Next, Save or a Share button that wobbles is still a tap.
 */
import 'react-native-gesture-handler/jestSetup';
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';

const mockClaims: unknown[] = [];

jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  return {
    GestureDetector: actual.GestureDetector,
    GestureHandlerRootView: actual.GestureHandlerRootView,
    LegacyFlatList: actual.LegacyFlatList,
    LegacyScrollView: actual.LegacyScrollView,
    NativeViewGestureHandler: actual.NativeViewGestureHandler,
    useLongPressGesture: (config: unknown) => {
      mockClaims.push(config);
      return actual.useLongPressGesture(config);
    },
  };
});

import {GestureHandlerRootView} from 'react-native-gesture-handler';
import * as SheetGestures from '@/components/sheets/SheetGestures';
import {FOOTER_CLAIM, SheetFooter, SheetScrollView} from '../sheetGestures';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  mockClaims.length = 0;
});

it("scrolls with the sheets' list", () => {
  expect(SheetScrollView).toBe(SheetGestures.SheetScrollView);
});

it("keeps the drag off its buttons with the sheets' footer", () => {
  expect(SheetFooter).toBe(SheetGestures.SheetFooter);
  expect(FOOTER_CLAIM).toBe(SheetGestures.FOOTER_CLAIM);
});

describe('SheetFooter', () => {
  function renderFooter() {
    act(() => {
      renderer = TestRenderer.create(
        <GestureHandlerRootView>
          <SheetFooter style={{paddingTop: 12, paddingBottom: 18}}>
            <Text>Next</Text>
          </SheetFooter>
        </GestureHandlerRootView>,
      );
    });
    if (!renderer) throw new Error('nothing rendered');
    return renderer.root;
  }

  it('claims its touches as the finger lands, however far it moves', () => {
    renderFooter();
    expect(mockClaims).toEqual([FOOTER_CLAIM]);
    // Active with no hold time, so the sheet's drag cannot start for the
    // touch...
    expect(FOOTER_CLAIM.minDuration).toBe(0);
    // ...and held as the finger wobbles or leaves the row.
    expect(FOOTER_CLAIM.maxDistance).toBeGreaterThanOrEqual(10000);
    expect(FOOTER_CLAIM.shouldCancelWhenOutside).toBe(false);
  });

  it('never cancels the press under the finger', () => {
    renderFooter();
    expect(FOOTER_CLAIM.cancelsJSResponder).toBe(false);
    expect(FOOTER_CLAIM.cancelsTouchesInView).toBe(false);
  });

  it('keeps the row and its own spacing around the buttons', () => {
    const root = renderFooter();
    const row = root.find(
      n =>
        typeof n.type === 'string' &&
        n.findAll(c => c.props.children === 'Next').length > 0 &&
        StyleSheet.flatten(n.props.style)?.paddingBottom !== undefined,
    );
    expect(StyleSheet.flatten(row.props.style)).toEqual({
      paddingTop: 12,
      paddingBottom: 18,
    });
  });
});
