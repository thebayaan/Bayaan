// @ai-generated
import React from 'react';
import {StyleSheet, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        primary: '#5B4FE0',
        background: '#FFFFFF',
        card: '#F2F2F2',
        error: '#D33',
      },
    },
  }),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({setSheetMode: jest.fn()}),
}));
const mockQueue = {tracks: [{rewayatId: 'hafs'}], currentIndex: 0};
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (selector: (s: unknown) => unknown) =>
    selector({queue: mockQueue}),
}));
jest.mock('@/store/ambientStore', () => ({
  useAmbientStore: (selector: (s: unknown) => unknown) =>
    selector({isEnabled: false}),
}));
jest.mock('@/store/timestampStore', () => ({
  useTimestampStore: (selector: (s: unknown) => unknown) =>
    selector({followAlongEnabled: false, isLocked: false}),
}));
let mockFollowAlongAvailable = false;
jest.mock('@/hooks/useFollowAlong', () => ({
  useRewayatFollowAlong: () => mockFollowAlongAvailable,
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/Icons', () => new Proxy({}, {get: () => () => null}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));
jest.mock('@react-native-community/slider', () => () => null);

import {
  PaneSwitcher,
  ReadingTools,
  TransportRow,
  useListeningTools,
} from '../PlayerParts';
import type {PlayerTransport} from '../usePlayerTransport';

const transport = (over: Partial<PlayerTransport> = {}): PlayerTransport =>
  ({
    currentTrack: undefined,
    trackLoading: false,
    isLastTrack: false,
    isPlaying: false,
    togglePlay: jest.fn(),
    previous: jest.fn(),
    next: jest.fn(),
    seekBack: jest.fn(),
    seekForward: jest.fn(),
    scrubber: {
      position: 0,
      duration: 0,
      isSeeking: false,
      onSlidingStart: jest.fn(),
      onValueChange: jest.fn(),
      onSlidingComplete: jest.fn(),
    },
    playbackRate: 1,
    repeatMode: 'none',
    cycleRepeat: jest.fn(),
    isTimerActive: false,
    ...over,
  }) as PlayerTransport;

function mount(el: Parameters<typeof TestRenderer.create>[0]) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(el);
  });
  return renderer;
}

const isInside = (
  node: TestRenderer.ReactTestInstance | null,
  outer: TestRenderer.ReactTestInstance,
): boolean => !!node && (node === outer || isInside(node.parent, outer));

/** The Pressables, innermost when a wrapper passes its props through. */
const pressables = (r: TestRenderer.ReactTestRenderer) => {
  const all = r.root.findAll(
    n => typeof n.props.onPress === 'function' && !!n.props.accessibilityRole,
  );
  return all.filter(n => !all.some(m => m !== n && isInside(m.parent, n)));
};

const textOf = (node: TestRenderer.ReactTestInstance) =>
  node.find(n => (n.type as unknown) === Text).props.children;

describe('PaneSwitcher', () => {
  it('offers Text, Queue and Reciters and marks the open one', () => {
    const onChange = jest.fn();
    const r = mount(
      <PaneSwitcher value="queue" onChange={onChange} showReciters />,
    );
    const tabs = pressables(r);
    expect(tabs.map(textOf)).toEqual(['Text', 'Queue', 'Reciters']);
    expect(tabs.map(t => t.props.accessibilityState.selected)).toEqual([
      false,
      true,
      false,
    ]);
    act(() => tabs[2].props.onPress());
    expect(onChange).toHaveBeenCalledWith('reciters');
  });

  it('leaves Reciters out when the track has no reciter', () => {
    const r = mount(
      <PaneSwitcher value="text" onChange={jest.fn()} showReciters={false} />,
    );
    expect(pressables(r)).toHaveLength(2);
  });
});

describe('TransportRow', () => {
  it('disables next on the last track and keeps the others', () => {
    const r = mount(
      <TransportRow transport={transport({isLastTrack: true})} />,
    );
    const labels = pressables(r).map(p => [
      p.props.accessibilityLabel,
      !!p.props.disabled,
    ]);
    expect(labels).toEqual([
      ['Back 15 seconds', false],
      ['Previous', false],
      ['Play', false],
      ['Next', true],
      ['Forward 15 seconds', false],
    ]);
  });
});

describe('useListeningTools', () => {
  function Tools({t}: {t: PlayerTransport}) {
    const tools = useListeningTools(t, {
      onSpeedPress: jest.fn(),
      onSleepTimerPress: jest.fn(),
      onAmbientPress: jest.fn(),
    });
    return (
      <>
        {tools.leading}
        {tools.trailing}
      </>
    );
  }

  it('fills the speed tool when the rate is not 1x', () => {
    const r = mount(<Tools t={transport({playbackRate: 1.5})} />);
    const [speed, repeat] = pressables(r);
    expect(textOf(speed)).toBe('1.5x');
    const fill = (p: TestRenderer.ReactTestInstance) =>
      StyleSheet.flatten(p.props.style({pressed: false})).backgroundColor;
    expect(fill(speed)).not.toBe('transparent');
    expect(fill(repeat)).toBe('transparent');
  });

  it('cycles repeat from its button', () => {
    const t = transport();
    const r = mount(<Tools t={t} />);
    act(() => pressables(r)[1].props.onPress());
    expect(t.cycleRepeat).toHaveBeenCalled();
  });
});

describe('ReadingTools', () => {
  it('keeps follow along pressable when the rewayah has no timings', () => {
    mockFollowAlongAvailable = false;
    const onFollowAlongPress = jest.fn();
    const r = mount(
      <ReadingTools
        onFollowAlongPress={onFollowAlongPress}
        onMushafLayoutPress={jest.fn()}
      />,
    );
    const [follow] = pressables(r);
    expect(follow.props.disabled).toBeFalsy();
    act(() => follow.props.onPress());
    expect(onFollowAlongPress).toHaveBeenCalled();
  });
});
