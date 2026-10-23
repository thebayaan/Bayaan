// @ai-generated
import React from 'react';
import {StyleSheet, Text, type ScrollViewProps} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {usePlayerScrollable} from '../usePlayerScrollable';
import {GorhomPlayerDismissProvider} from '@/components/player/v2/GorhomPlayerDismissProvider';

let mockDirection: 'ltr' | 'rtl' = 'rtl';
const mockCreateScrollable = jest.fn();

jest.mock('@/utils/rtl', () => ({
  forceLTR: {direction: 'ltr'},
  get appLayoutDirection() {
    return {direction: mockDirection};
  },
}));

jest.mock('react-native-reanimated', () => ({runOnJS: (fn: unknown) => fn}));

jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of [
    'onStart',
    'onChange',
    'onEnd',
    'onFinalize',
    'shouldCancelWhenOutside',
    'runOnJS',
    'enabled',
  ]) {
    chain[m] = self;
  }
  return {Gesture: {Pan: self}};
});

jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({setSheetMode: jest.fn()}),
}));

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({sheetMode: 'hidden'})},
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const {createElement} = require('react');
  const {ScrollView: NativeScrollView} = require('react-native');
  const createScrollable = (props: ScrollViewProps) =>
    mockCreateScrollable(props) || createElement(NativeScrollView, props);
  const handlePanGestureHandler = {
    handleOnStart: jest.fn(),
    handleOnChange: jest.fn(),
    handleOnEnd: jest.fn(),
    handleOnFinalize: jest.fn(),
  };
  return {
    useBottomSheetScrollableCreator: () => createScrollable,
    useBottomSheetGestureHandlers: () => ({handlePanGestureHandler}),
    useBottomSheetInternal: () => ({
      animatedPosition: {value: 0},
      animatedLayoutState: {get: () => ({containerHeight: 0})},
    }),
  };
});

function PlayerList(props: ScrollViewProps) {
  const Scrollable = usePlayerScrollable();
  if (!Scrollable) throw new Error('No player scrollable in context');
  return <Scrollable {...props} />;
}

it('is undefined outside a player container', () => {
  let scrollable: unknown = 'unset';
  function Probe() {
    scrollable = usePlayerScrollable();
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  expect(scrollable).toBeUndefined();
});

it.each(['ltr', 'rtl'] as const)(
  'keeps locked scroll coordinates stable with %s player content',
  direction => {
    mockDirection = direction;
    mockCreateScrollable.mockClear();
    const onScroll = jest.fn();
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(
        <GorhomPlayerDismissProvider>
          <PlayerList
            style={{width: 320, direction: 'rtl'}}
            contentContainerStyle={{paddingBottom: 80}}
            onScroll={onScroll}
            scrollEventThrottle={16}>
            <Text testID="verse-title">الفاتحة</Text>
          </PlayerList>
        </GorhomPlayerDismissProvider>,
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
