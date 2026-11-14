// @ai-generated
/**
 * The What's New pager is as tall as its tallest page, and never shorter than
 * the floor. Each page is a scroll view, which does not take the height of
 * its content, so the pages report it. When the card is full, flexbox shrinks
 * the pager and a long page scrolls instead of losing its last lines.
 */

import React, {act, createRef} from 'react';
import TestRenderer, {type ReactTestRenderer} from 'react-test-renderer';
import {ScrollView, StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {WhatsNewModal, type WhatsNewModalRef} from '..';

jest.mock('react-native-reanimated', () => {
  const {View: MockView, FlatList: MockFlatList} =
    jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {View: MockView, FlatList: MockFlatList},
    ZoomIn: {duration: () => ({springify: () => undefined})},
    useSharedValue: (v: number) => ({value: v}),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => undefined,
    interpolate: () => 0,
  };
});
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        backgroundSecondary: '#ffffff',
      },
    },
  }),
}));
jest.mock('@expo/vector-icons', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {Ionicons: MockView};
});
jest.mock('@/components/Icons', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return new Proxy({}, {get: () => MockView});
});
jest.mock('@/utils/versionUtils', () => ({
  hasVersionChanged: jest.fn(async () => false),
  markVersionAsSeen: jest.fn(async () => undefined),
  getLastSeenVersion: jest.fn(async () => null),
  filterPagesByVersion: <T,>(pages: T[]) => pages,
}));

const FLOOR = moderateScale(280);

// The list renders its cells on timers; fake timers keep them inside act().
const roots: ReactTestRenderer[] = [];
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => roots.splice(0).forEach(root => root.unmount()));
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

function render() {
  const ref = createRef<WhatsNewModalRef>();
  let root!: ReactTestRenderer;
  act(() => {
    root = TestRenderer.create(<WhatsNewModal ref={ref} />);
  });
  roots.push(root);
  act(() => ref.current?.show());
  act(() => jest.runOnlyPendingTimers());
  return root;
}

function scrollViews(root: ReactTestRenderer) {
  const all = root.root.findAll(node => node.type === (ScrollView as unknown));
  return {
    pager: all.filter(node => node.props.horizontal)[0],
    pages: all.filter(node => !node.props.horizontal),
  };
}

function pagerHeight(root: ReactTestRenderer) {
  return StyleSheet.flatten(scrollViews(root).pager.props.style).height;
}

function reportContentHeight(page: TestRenderer.ReactTestInstance, h: number) {
  act(() => page.props.onContentSizeChange(200, h));
}

describe("What's New pager height", () => {
  it('renders every page at once, each in its own vertical scroll view', () => {
    const root = render();
    const {pages} = scrollViews(root);
    expect(pages.length).toBeGreaterThan(10);
    expect(pages.every(page => page.props.bounces === false)).toBe(true);
  });

  it('is the floor before any page reports its height', () => {
    expect(pagerHeight(render())).toBe(FLOOR);
  });

  it('is the floor when every page is shorter', () => {
    const root = render();
    scrollViews(root).pages.forEach(page => reportContentHeight(page, 100));
    expect(pagerHeight(root)).toBe(FLOOR);
  });

  it('follows the tallest page', () => {
    const root = render();
    const {pages} = scrollViews(root);
    reportContentHeight(pages[3], FLOOR + 100);
    reportContentHeight(pages[5], FLOOR + 40);
    expect(pagerHeight(root)).toBe(FLOOR + 100);
  });

  it('shrinks again when the tallest page gets shorter', () => {
    const root = render();
    const {pages} = scrollViews(root);
    reportContentHeight(pages[3], FLOOR + 100);
    reportContentHeight(pages[5], FLOOR + 40);
    reportContentHeight(pages[3], FLOOR + 10);
    expect(pagerHeight(root)).toBe(FLOOR + 40);
  });
});
