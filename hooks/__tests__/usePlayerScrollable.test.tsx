// @ai-generated
import React from 'react';
import {StyleSheet, Text, type ScrollViewProps} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {usePlayerScrollable} from '../usePlayerScrollable';

let mockDirection: 'ltr' | 'rtl' = 'rtl';
const mockCreateScrollable = jest.fn();

jest.mock('@/utils/rtl', () => ({
  forceLTR: {direction: 'ltr'},
  get appLayoutDirection() {
    return {direction: mockDirection};
  },
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const {createElement} = require('react');
  const {ScrollView: NativeScrollView} = require('react-native');
  const createScrollable = (props: ScrollViewProps) =>
    mockCreateScrollable(props) || createElement(NativeScrollView, props);
  return {useBottomSheetScrollableCreator: () => createScrollable};
});

function PlayerList(props: ScrollViewProps) {
  const Scrollable = usePlayerScrollable();
  return <Scrollable {...props} />;
}

it.each(['ltr', 'rtl'] as const)(
  'keeps locked scroll coordinates stable with %s player content',
  direction => {
    mockDirection = direction;
    mockCreateScrollable.mockClear();
    const onScroll = jest.fn();
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(
        <PlayerList
          style={{width: 320, direction: 'rtl'}}
          contentContainerStyle={{paddingBottom: 80}}
          onScroll={onScroll}
          scrollEventThrottle={16}>
          <Text testID="verse-title">الفاتحة</Text>
        </PlayerList>,
      );
    });

    if (!tree) throw new Error('Player list did not mount');
    const props = mockCreateScrollable.mock.lastCall?.[0] as ScrollViewProps;
    expect(StyleSheet.flatten(props.style)).toEqual({
      width: 320,
      direction: 'ltr',
    });
    expect(StyleSheet.flatten(props.contentContainerStyle)).toEqual({
      paddingBottom: 80,
      direction,
    });
    expect(props.onScroll).toBe(onScroll);
    expect(props.scrollEventThrottle).toBe(16);
    expect(tree.root.findByProps({testID: 'verse-title'}).props.children).toBe(
      'الفاتحة',
    );
    act(() => tree?.unmount());
  },
);
