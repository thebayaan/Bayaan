// @ai-generated
import React from 'react';
import {ScrollView, StyleSheet, Text, type ScrollViewProps} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {usePlayerScrollable} from '../usePlayerScrollable';
import {PlayerDismissProvider} from '@/components/player/v2/PlayerDismissContext';
import {createSurfaceScrollable} from '@/components/player/v2/PlayerSurface/SurfaceScrollable';

let mockDirection: 'ltr' | 'rtl' = 'rtl';

jest.mock('@/utils/rtl', () => ({
  forceLTR: {direction: 'ltr'},
  get appLayoutDirection() {
    return {direction: mockDirection};
  },
}));

jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: unknown) => ({value}),
}));

jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of [
    'manualActivation',
    'onTouchesDown',
    'onTouchesMove',
    'onStart',
    'onUpdate',
    'onEnd',
    'simultaneousWithExternalGesture',
    'enabled',
  ]) {
    chain[m] = self;
  }
  return {
    Gesture: {Pan: self, Native: self, Simultaneous: self},
    GestureDetector: ({children}: {children: React.ReactNode}) => children,
  };
});

const motion = {
  progress: {value: 1},
  onDragStart: jest.fn(),
  onDragUpdate: jest.fn(),
  onDragEnd: jest.fn(),
} as unknown as Parameters<typeof createSurfaceScrollable>[0];

const SurfaceScrollable = createSurfaceScrollable(motion);

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
  'keeps scroll coordinates stable with %s player content',
  direction => {
    mockDirection = direction;
    const onScroll = jest.fn();
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(
        <PlayerDismissProvider
          value={{
            createDismissGesture: jest.fn(),
            renderScrollComponent: SurfaceScrollable,
          }}>
          <PlayerList
            style={{width: 320, direction: 'rtl'}}
            contentContainerStyle={{paddingBottom: 80}}
            onScroll={onScroll}>
            <Text testID="verse-title">الفاتحة</Text>
          </PlayerList>
        </PlayerDismissProvider>,
      );
    });

    if (!tree) throw new Error('Player list did not mount');
    const props = tree.root.findByType(ScrollView as never)
      .props as ScrollViewProps;
    expect(StyleSheet.flatten(props.style)).toEqual({
      width: 320,
      direction: 'ltr',
    });
    expect(StyleSheet.flatten(props.contentContainerStyle)).toEqual({
      paddingBottom: 80,
      direction,
    });
    expect(props.bounces).toBe(false);

    // The surface tracks the offset for the dismiss handoff and still
    // forwards scroll events to the list.
    const event = {nativeEvent: {contentOffset: {x: 0, y: 42}}};
    act(() => props.onScroll?.(event as never));
    expect(onScroll).toHaveBeenCalledWith(event);
    expect(tree.root.findByProps({testID: 'verse-title'}).props.children).toBe(
      'الفاتحة',
    );
    act(() => tree?.unmount());
  },
);
