// @ai-generated
import React from 'react';
import {Text, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {primary: '#5B4FE0'}}}),
}));
jest.mock('@/hooks/useReadingThemeColors', () => ({
  useReadingThemeColors: () => ({
    text: '#111111',
    textSecondary: '#666666',
    card: '#F2F2F2',
  }),
}));
jest.mock('@/hooks/usePlayerA11y', () => ({
  usePlayerA11y: () => ({repeat: () => ({accessibilityLabel: 'Repeat'})}),
}));
const mockActions = {
  updateQueue: jest.fn().mockResolvedValue(undefined),
  removeFromQueue: jest.fn().mockResolvedValue(undefined),
  moveInQueue: jest.fn(),
  shuffleUpNext: jest.fn(),
  play: jest.fn().mockResolvedValue(undefined),
  updateSettings: jest.fn(),
};
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => mockActions,
}));
const mockNavigateToReciter = jest.fn();
jest.mock('@/hooks/useReciterNavigation', () => ({
  useReciterNavigation: () => ({
    navigateToReciterProfile: mockNavigateToReciter,
  }),
}));

type MockTrack = {id: string; title: string; reciterId?: string};
let mockQueue: {tracks: MockTrack[]; currentIndex: number};
let mockRepeatMode = 'none';
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (selector: (s: unknown) => unknown) =>
    selector({
      queue: mockQueue,
      settings: {repeatMode: mockRepeatMode},
      playback: {state: 'paused'},
    }),
}));
jest.mock('../../PlayerContent/QueueList', () => ({
  useRowDisplay: (track: MockTrack) => ({
    title: track.title,
    subtitle: 'Reciter',
    tags: [],
    surahId: 1,
  }),
}));
jest.mock('@/i18n/format', () => ({
  ...jest.requireActual('@/i18n/format'),
  getTrackDisplayTitle: (track: MockTrack) => track.title,
  getTrackArtistDisplay: () => 'Reciter',
}));
const mockShowSheet = jest.fn();
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: (...args: unknown[]) => mockShowSheet(...args)},
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/NowPlayingIndicator', () => ({
  NowPlayingIndicator: () => null,
}));
jest.mock('@/components/Icons', () => new Proxy({}, {get: () => () => null}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
}));

// The real list needs Reanimated and gesture handler; this one renders the
// header, each row and the footer, and keeps its callbacks to call directly.
interface MockListProps {
  data: unknown[];
  keyExtractor: (item: unknown) => string;
  renderItem: (params: object) => React.ReactNode;
  onDragEnd: (params: {from: number; to: number}) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onContainerLayout: (params: {layout: {height: number}}) => void;
  onScrollOffsetChange: (offset: number) => void;
  scrollEnabled?: boolean;
  ListHeaderComponent: React.ReactNode;
  ListFooterComponent: React.ReactNode;
}
const mockDrag = jest.fn();
const mockScrollToOffset = jest.fn();
jest.mock('react-native-draggable-flatlist', () => {
  const {forwardRef, useImperativeHandle} = jest.requireActual('react');
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: forwardRef((props: MockListProps, ref: unknown) => {
      useImperativeHandle(ref, () => ({scrollToOffset: mockScrollToOffset}));
      return (
        <MockView
          testID="list"
          onDragEnd={props.onDragEnd}
          onContentSizeChange={props.onContentSizeChange}
          onContainerLayout={props.onContainerLayout}
          onScrollOffsetChange={props.onScrollOffsetChange}
          scrollEnabled={props.scrollEnabled}>
          {props.ListHeaderComponent}
          {props.data.map((item, i) => (
            <MockView key={props.keyExtractor(item)}>
              {props.renderItem({
                item,
                drag: mockDrag,
                isActive: false,
                getIndex: () => i,
              })}
            </MockView>
          ))}
          {props.ListFooterComponent}
        </MockView>
      );
    }),
  };
});

import {QueuePane} from '../QueuePane';

const track = (id: string): MockTrack => ({
  id,
  title: `Surah ${id}`,
  reciterId: 'r1',
});

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<QueuePane bottomInset={20} />);
  });
  return renderer;
}

/** The innermost element with this label that takes a press. */
const button = (r: TestRenderer.ReactTestRenderer, label: string) => {
  const all = r.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  );
  return all[all.length - 1];
};

const texts = (r: TestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as unknown) === Text)
    .map(n => [n.props.children].flat().join(''));

/** The Played row, which opens and closes the played tracks. */
const disclosure = (r: TestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(
      n =>
        n.props.accessibilityState?.expanded !== undefined &&
        typeof n.props.onPress === 'function',
    )
    .pop();

beforeEach(() => {
  // a was played, b is playing, c and d are up next.
  mockQueue = {tracks: ['a', 'b', 'c', 'd'].map(track), currentIndex: 1};
  mockRepeatMode = 'none';
  jest.clearAllMocks();
});

describe('QueuePane', () => {
  it('shows the current track and counts what is up next', () => {
    const shown = texts(render());
    expect(shown).toEqual(
      expect.arrayContaining(['Up Next', '2 tracks', 'Now Playing']),
    );
    expect(shown.indexOf('Surah b')).toBeLessThan(shown.indexOf('Surah c'));
    expect(shown.indexOf('Surah c')).toBeLessThan(shown.indexOf('Surah d'));
    // The played track waits behind its disclosure row.
    expect(shown).not.toContain('Surah a');
  });

  it('clears only the tracks after the current one', () => {
    const r = render();
    act(() => button(r, 'Clear Up Next').props.onPress());
    expect(mockActions.removeFromQueue).toHaveBeenCalledWith([2, 3]);
  });

  it('shuffles Up Next, and only when there are two tracks to shuffle', () => {
    const r = render();
    act(() => button(r, 'Shuffle').props.onPress());
    expect(mockActions.shuffleUpNext).toHaveBeenCalled();

    mockQueue = {...mockQueue, currentIndex: 2};
    expect(button(render(), 'Shuffle').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('cycles repeat from its chip', () => {
    const r = render();
    act(() => button(r, 'Repeat').props.onPress());
    expect(mockActions.updateSettings).toHaveBeenCalledWith({
      repeatMode: 'queue',
    });
  });

  it('names the repeat mode on its chip', () => {
    expect(texts(render())).toContain('Repeat');
    mockRepeatMode = 'queue';
    expect(texts(render())).toContain('Repeat All');
    mockRepeatMode = 'track';
    expect(texts(render())).toContain('Repeat One');
  });

  it('opens a menu for a row that can play it next', () => {
    const r = render();
    act(() => button(r, 'More options for Surah d').props.onPress());
    const [id, {payload}] = mockShowSheet.mock.calls[0];
    expect(id).toBe('collection-options');
    expect(payload.title).toBe('Surah d');
    expect(payload.options.map((o: {label: string}) => o.label)).toEqual([
      'Play Now',
      'Play Next',
      'Go to Reciter',
      'Remove',
    ]);

    payload.options[1].onPress();
    expect(mockActions.moveInQueue).toHaveBeenCalledWith(3, 2);
    payload.options[3].onPress();
    expect(mockActions.removeFromQueue).toHaveBeenCalledWith([3]);
  });

  it('leaves Play Next out for the track that is already next', () => {
    const r = render();
    act(() => button(r, 'More options for Surah c').props.onPress());
    const [, {payload}] = mockShowSheet.mock.calls[0];
    expect(payload.options.map((o: {label: string}) => o.label)).not.toContain(
      'Play Next',
    );
  });

  it('moves a dragged row to its place in the whole queue', () => {
    const r = render();
    const [list] = r.root.findAll(
      n => n.props.testID === 'list' && (n.type as unknown) === View,
    );
    act(() => list.props.onDragEnd({from: 0, to: 1}));
    expect(mockActions.moveInQueue).toHaveBeenCalledWith(2, 3);

    mockActions.moveInQueue.mockClear();
    act(() => list.props.onDragEnd({from: 1, to: 1}));
    expect(mockActions.moveInQueue).not.toHaveBeenCalled();
  });

  it('lifts a row when its handle is held, not on touch down', () => {
    const r = render();
    const handle = r.root.findAll(
      n =>
        n.props.accessibilityLabel === 'Reorder Surah c' &&
        typeof n.props.onLongPress === 'function',
    );
    const inner = handle[handle.length - 1];
    const list = () => r.root.findByProps({testID: 'list'});
    expect(inner.props.delayLongPress).toBeGreaterThan(0);
    expect(list().props.scrollEnabled).toBe(true);

    // A finger on the handle stops the list scrolling but lifts nothing yet.
    act(() => inner.props.onPressIn());
    expect(mockDrag).not.toHaveBeenCalled();
    expect(list().props.scrollEnabled).toBe(false);

    act(() => inner.props.onLongPress());
    expect(mockDrag).toHaveBeenCalled();
    act(() => inner.props.onPressOut());
    expect(list().props.scrollEnabled).toBe(true);
  });

  it('offers VoiceOver move actions that stay inside Up Next', () => {
    const r = render();
    const row = button(r, 'Surah c, Reciter');
    expect(
      row.props.accessibilityActions.map((a: {name: string}) => a.name),
    ).toEqual(['moveDown']);
    act(() =>
      row.props.onAccessibilityAction({nativeEvent: {actionName: 'moveDown'}}),
    );
    expect(mockActions.moveInQueue).toHaveBeenCalledWith(2, 3);
  });

  it('shows the played tracks when their row is opened', () => {
    const r = render();
    expect(disclosure(r)).toBeDefined();
    act(() => disclosure(r)?.props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['Played (1)', 'Surah a']));
  });

  describe('scrolling the played tracks into view', () => {
    // A 500pt list scrolled to 400 of 900pt. The 44pt Played row ends at the
    // bottom padding (20 + 24), so it starts at 900 - 44 - 44 = 812.
    function openPlayed(newHeight: number, offset = 400) {
      const r = render();
      const list = r.root.findByProps({testID: 'list'});
      act(() => {
        list.props.onContainerLayout({layout: {height: 500}});
        list.props.onContentSizeChange(320, 900);
        list.props.onScrollOffsetChange(offset);
        disclosure(r)?.props.onLayout({nativeEvent: {layout: {height: 44}}});
      });
      act(() => disclosure(r)?.props.onPress());
      act(() => list.props.onContentSizeChange(320, newHeight));
      return {r, list};
    }

    it('scrolls to the end when the rows fit under the Played row', () => {
      openPlayed(1300);
      expect(mockScrollToOffset).toHaveBeenCalledWith({
        offset: 800,
        animated: true,
      });
    });

    it('stops with the Played row at the top when they do not', () => {
      openPlayed(2000);
      expect(mockScrollToOffset).toHaveBeenCalledWith({
        offset: 812,
        animated: true,
      });
    });

    it('never scrolls back up, nor when the rows close', () => {
      const {r, list} = openPlayed(1300, 850);
      expect(mockScrollToOffset).not.toHaveBeenCalled();
      act(() => disclosure(r)?.props.onPress());
      act(() => list.props.onContentSizeChange(320, 900));
      expect(mockScrollToOffset).not.toHaveBeenCalled();
    });
  });

  it('plays a tapped row', async () => {
    const r = render();
    await act(async () => {
      await button(r, 'Surah d, Reciter').props.onPress();
    });
    expect(mockActions.updateQueue).toHaveBeenCalledWith(mockQueue.tracks, 3);
    expect(mockActions.play).toHaveBeenCalled();
  });
});
