// @ai-generated
import React from 'react';
import {View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

let mockWindow = {width: 1032, height: 1376};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({...mockWindow, scale: 2, fontScale: 1}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 24, bottom: 20, left: 0, right: 0}),
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('../../PlayerDismissContext', () => ({
  usePlayerDismissGesture: () => ({}),
}));

const mockSetImmersive = jest.fn();
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({setImmersive: mockSetImmersive}),
}));
jest.mock('@/hooks/useReadingThemeColors', () => ({
  useReadingThemeColors: () => ({background: '#F5F1E8'}),
}));
jest.mock('@/hooks/useTimestampLoader', () => ({
  useTimestampLoader: jest.fn(),
}));
jest.mock('@/hooks/useAyahTracker', () => ({useAyahTracker: jest.fn()}));

let mockTrack: {reciterId?: string} | undefined = {reciterId: 'r1'};
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (selector: (s: unknown) => unknown) =>
    selector({queue: {tracks: mockTrack ? [mockTrack] : [], currentIndex: 0}}),
}));

jest.mock('../PlayerParts', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    CloseButton: () => <MockView testID="close" />,
    MoreButton: () => <MockView testID="more" />,
    ReadingTools: () => <MockView testID="reading-tools" />,
    PaneSwitcher: (props: object) => (
      <MockView testID="pane-switcher" {...props} />
    ),
  };
});
jest.mock('../NowPlayingColumn', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    NowPlayingColumn: (props: object) => (
      <MockView testID="now-playing-column" {...props} />
    ),
  };
});
jest.mock('../TransportCard', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    TransportCard: (props: object) => (
      <MockView testID="transport-card" {...props} />
    ),
  };
});
jest.mock('../PlayerPaneBody', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    PlayerPaneBody: (props: object) => (
      <MockView testID="pane-body" {...props} />
    ),
  };
});

import {TabletPlayerLayout} from '../TabletPlayerLayout';

const handlers = {
  onSpeedPress: jest.fn(),
  onSleepTimerPress: jest.fn(),
  onMushafLayoutPress: jest.fn(),
  onAmbientPress: jest.fn(),
  onOptionsPress: jest.fn(),
  onFollowAlongPress: jest.fn(),
};

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<TabletPlayerLayout {...handlers} />);
  });
  return renderer;
}

const byId = (renderer: TestRenderer.ReactTestRenderer, id: string) =>
  renderer.root.findAll(
    n => n.props.testID === id && (n.type as unknown) === View,
  );

beforeEach(() => {
  mockWindow = {width: 1032, height: 1376};
  mockTrack = {reciterId: 'r1'};
  mockSetImmersive.mockClear();
});

describe('TabletPlayerLayout', () => {
  it('shows two panes on an expanded window (13" portrait)', () => {
    const renderer = render();
    const [column] = byId(renderer, 'now-playing-column');
    expect(column.props.width).toBe(413);
    expect(column.props.margin).toBe(32);
    expect(column.props.artSize).toBe(349);
    const [body] = byId(renderer, 'pane-body');
    expect(body.props.width).toBe(1032 - 413);
    expect(body.props.bottomInset).toBe(20);
    expect(byId(renderer, 'transport-card')).toHaveLength(0);
    // The column has its own close button; the pane bar has none.
    expect(byId(renderer, 'close')).toHaveLength(0);
  });

  it('stacks on a medium window (11" portrait) with a floating card', () => {
    mockWindow = {width: 834, height: 1194};
    const renderer = render();
    expect(byId(renderer, 'now-playing-column')).toHaveLength(0);
    const [card] = byId(renderer, 'transport-card');
    expect(card.props.width).toBe(680);
    expect(byId(renderer, 'close')).toHaveLength(1);
    // The card has the track's "..."; the bar does not repeat it.
    expect(byId(renderer, 'more')).toHaveLength(0);
    expect(card.props.onOptionsPress).toBe(handlers.onOptionsPress);

    // The pane keeps the card's height clear once it is measured.
    act(() => {
      card.props.onLayout({nativeEvent: {layout: {height: 228}}});
    });
    const [body] = byId(renderer, 'pane-body');
    expect(body.props.width).toBe(834);
    expect(body.props.bottomInset).toBe(20 + 24 + 228);
  });

  it('narrows the card to the margins of a window under 728pt', () => {
    mockWindow = {width: 683, height: 1024};
    const [card] = byId(render(), 'transport-card');
    expect(card.props.width).toBe(683 - 48);
  });

  it('switches panes and shows the reading tools only on Text', () => {
    const renderer = render();
    expect(byId(renderer, 'reading-tools')).toHaveLength(1);
    const [switcher] = byId(renderer, 'pane-switcher');
    expect(switcher.props.value).toBe('text');
    expect(switcher.props.showReciters).toBe(true);

    act(() => {
      switcher.props.onChange('queue');
    });
    expect(byId(renderer, 'pane-body')[0].props.pane).toBe('queue');
    expect(byId(renderer, 'reading-tools')).toHaveLength(0);
  });

  it('falls back to Text when the track has no reciter', () => {
    const renderer = render();
    act(() => {
      byId(renderer, 'pane-switcher')[0].props.onChange('reciters');
    });
    expect(byId(renderer, 'pane-body')[0].props.pane).toBe('reciters');

    mockTrack = {};
    act(() => {
      renderer.update(<TabletPlayerLayout {...handlers} />);
    });
    const [switcher] = byId(renderer, 'pane-switcher');
    expect(switcher.props.showReciters).toBe(false);
    expect(switcher.props.value).toBe('text');
    expect(byId(renderer, 'pane-body')[0].props.pane).toBe('text');
  });

  it('turns immersive mode off, since nothing covers the text', () => {
    render();
    expect(mockSetImmersive).toHaveBeenCalledWith(false);
  });
});
