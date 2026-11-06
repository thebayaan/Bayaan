// @ai-generated
import React from 'react';
import {View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {Reciter} from '@/data/reciterData';
import type {Theme} from '@/utils/themeUtils';

// @ai-start
type MockListProps = {
  extraData: {width: number; height: number};
  contentContainerStyle: {paddingHorizontal: number};
  renderItem: (info: {item: Reciter[]}) => React.ReactElement<{
    children: React.ReactNode;
  }>;
};
const mockListProps: MockListProps[] = [];
jest.mock('@legendapp/list', () => ({
  LegendList: (props: MockListProps) => {
    mockListProps.push(props);
    return null;
  },
}));
jest.mock('@/components/browse/BrowseReciterCard', () => ({
  BrowseReciterCard: () => null,
  TABLET_CAPTION_HEIGHT: 52,
}));
// @ai-end
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 1032, height: 1376, scale: 2, fontScale: 1}),
}));

import BrowseGrid from '@/components/browse/BrowseGrid';
import {BrowseReciterCard} from '@/components/browse/BrowseReciterCard'; // @ai

const theme = {colors: {text: '#000'}} as unknown as Theme;
const reciters = [{id: 'r1'}, {id: 'r2'}] as unknown as Reciter[];

it('renders the list only once the container is measured, at that width', () => {
  let r: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(
      <BrowseGrid
        reciters={reciters}
        onReciterPress={jest.fn()}
        theme={theme}
      />,
    );
  });
  // Nothing is drawn at the window-width guess, so no stale rows get recycled.
  expect(mockListProps).toHaveLength(0);

  const container = r!.root.findAll(
    n => (n.type as unknown) === View && !!n.props.onLayout,
  )[0];
  act(() => {
    container.props.onLayout({
      nativeEvent: {layout: {width: 600, height: 800}},
    });
  });
  const narrow = mockListProps[mockListProps.length - 1].extraData.width;
  expect(narrow).toBeLessThan(600 / 3);

  // A later width change hands the list new extraData so rows redraw.
  act(() => {
    container.props.onLayout({
      nativeEvent: {layout: {width: 900, height: 800}},
    });
  });
  expect(mockListProps[mockListProps.length - 1].extraData.width).not.toBe(
    narrow,
  );
});

// @ai-start
function renderMeasured(
  props: Partial<React.ComponentProps<typeof BrowseGrid>>,
  width: number,
) {
  mockListProps.length = 0;
  let r: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(
      <BrowseGrid
        reciters={reciters}
        onReciterPress={jest.fn()}
        theme={theme}
        {...props}
      />,
    );
  });
  if (!r) throw new Error('not rendered');
  const mounted = r;
  const container = mounted.root.findAll(
    n => (n.type as unknown) === View && !!n.props.onLayout,
  )[0];
  act(() => {
    container.props.onLayout({nativeEvent: {layout: {width, height: 800}}});
  });
  const list = mockListProps[mockListProps.length - 1];
  const row = list.renderItem({item: reciters});
  const cards = React.Children.toArray(row.props.children).filter(
    (
      c,
    ): c is React.ReactElement<
      React.ComponentProps<typeof BrowseReciterCard>
    > => React.isValidElement(c) && c.type === BrowseReciterCard,
  );
  act(() => mounted.unmount());
  return {list, cards};
}

it('lays the iPad grid out in the page margins with square art', () => {
  // 11" portrait pane: 698pt inside 24pt margins gives four 162.5pt cards.
  const {list, cards} = renderMeasured({tabletMargin: 24}, 746);
  expect(list.contentContainerStyle.paddingHorizontal).toBe(24);
  expect(list.extraData).toEqual({width: 162.5, height: 162.5 + 52});
  expect(cards[0].props.tabletText).toBe(true);
  // Cards link to profiles here, so there is nothing to play.
  expect(cards[0].props.showPlayBadge).toBe(false);
});

it('fits five columns on a wide iPad pane', () => {
  const {list} = renderMeasured({tabletMargin: 32}, 1096);
  // (1096 - 64 - 4 * 16) / 5
  expect(list.extraData.width).toBeCloseTo(193.6);
});

it('puts a play badge on iPad cards whose tap plays', () => {
  const {cards} = renderMeasured({tabletMargin: 24, linkToProfile: false}, 746);
  expect(cards).toHaveLength(2);
  expect(cards.every(c => c.props.showPlayBadge)).toBe(true);
});

it('keeps the phone layout without a tablet margin', () => {
  const {list, cards} = renderMeasured({linkToProfile: false}, 393);
  expect(list.contentContainerStyle.paddingHorizontal).not.toBe(24);
  expect(list.extraData.height).toBeCloseTo(list.extraData.width * 1.2);
  expect(cards[0].props.tabletText).toBe(false);
  expect(cards[0].props.showPlayBadge).toBe(false);
});
// @ai-end
