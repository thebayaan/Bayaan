// @ai-generated
import React from 'react';
import {View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {Theme} from '@/utils/themeUtils';
import type {CollectionItem} from '@/components/collection/CollectionGrid';

type ListProps = {data: unknown[][]; extraData: {width: number}};
const mockListProps: ListProps[] = [];
jest.mock('@legendapp/list', () => ({
  LegendList: (props: ListProps) => {
    mockListProps.push(props);
    return null;
  },
}));
jest.mock('@/components/cards/PlaylistCard', () => ({
  PlaylistCard: () => null,
}));
jest.mock('@/components/cards/CircularReciterCard', () => ({
  CircularReciterCard: () => null,
}));
jest.mock('@/components/cards/LovedCard', () => ({LovedCard: () => null}));
jest.mock('@/components/cards/DownloadCard', () => ({
  DownloadCard: () => null,
}));
jest.mock('@/components/cards/TrackCard', () => ({TrackCard: () => null}));
jest.mock('@/components/cards/ReciterDownloadsStackCard', () => ({
  ReciterDownloadsStackCard: () => null,
}));
jest.mock('@/components/cards/UploadCard', () => ({UploadCard: () => null}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 1032, height: 1376, scale: 2, fontScale: 1}),
}));

import {CollectionGrid} from '@/components/collection/CollectionGrid';

const theme = {colors: {text: '#000'}} as unknown as Theme;
const items = Array.from({length: 12}, (_, i) => ({
  id: `p${i}`,
  type: 'playlist',
  data: {name: `Playlist ${i}`, itemCount: 1, onPress: jest.fn()},
})) as unknown as CollectionItem[];

function layout(r: TestRenderer.ReactTestRenderer, width: number) {
  const container = r.root.findAll(
    n => (n.type as unknown) === View && !!n.props.onLayout,
  )[0];
  act(() => {
    container.props.onLayout({nativeEvent: {layout: {width, height: 800}}});
  });
  return mockListProps[mockListProps.length - 1];
}

it('sizes columns from its container, not the window', () => {
  let r: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(<CollectionGrid items={items} theme={theme} />);
  });
  // Nothing is drawn at the window-width guess, so no stale rows get recycled.
  expect(mockListProps).toHaveLength(0);

  // A 720pt pane on a 1032pt window: every row has to fit in the 720pt.
  const props = layout(r!, 720);
  const columns = props.data[0].length;
  const rowWidth = columns * props.extraData.width;
  expect(rowWidth).toBeLessThan(720);

  // A wider pane gets new extraData so recycled rows redraw.
  const wider = layout(r!, 944);
  expect(wider.extraData.width).not.toBe(props.extraData.width);
});
