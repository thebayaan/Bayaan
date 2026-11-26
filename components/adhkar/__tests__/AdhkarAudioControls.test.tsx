import React from 'react';
import {StyleSheet} from 'react-native';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {AdhkarAudioControls} from '@/components/adhkar/AdhkarAudioControls';
import {AdhkarSessionSourceProvider} from '@/components/adhkar/AdhkarSessionSourceContext';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {SessionSource} from '@/services/adhkar/playback/types';

// The repo has no @testing-library/react-native, so this suite uses
// react-test-renderer like the other component suites here.

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
      },
      fonts: {regular: 'Regular', semiBold: 'SemiBold'},
    },
  }),
}));
// Icon fonts load asynchronously and update outside act.
jest.mock('@expo/vector-icons', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {Feather: MockView, Ionicons: MockView};
});
jest.mock('@react-native-community/slider', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {__esModule: true, default: MockView};
});
jest.mock('@/utils/adhkarAudio', () => ({
  hasAudio: (f: string | null) => f !== null,
  getAudioSource: () => 1,
}));
// @ai-start
let mockPosition = {currentTime: 0, duration: 10};
const mockSeek = jest.fn();
jest.mock('@/services/adhkar/playback/adhkarPlaybackEngine', () => ({
  getAdhkarPlaybackPosition: () => mockPosition,
  seekAdhkarPlayback: (seconds: number) => mockSeek(seconds),
}));
// @ai-end

const src: SessionSource = {
  listId: 'morning-adhkar',
  listTitle: 'Morning',
  items: ['a', 'b'].map(id => ({
    dhikrId: id,
    audioFile: `${id}.mp3`,
    playable: true,
    preview: id,
  })),
};

let mounted: ReactTestRenderer | undefined;

function renderCard(dhikrId: string): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <AdhkarSessionSourceProvider source={src}>
        <AdhkarAudioControls
          dhikrId={dhikrId}
          audioFile={`${dhikrId}.mp3`}
          onCopy={jest.fn()}
          onBookmark={jest.fn()}
          onShare={jest.fn()}
          onSettings={jest.fn()}
          isBookmarked={false}
        />
      </AdhkarSessionSourceProvider>,
    );
  });
  if (!renderer) throw new Error('not rendered');
  mounted = renderer;
  return renderer;
}

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
});

beforeEach(() => {
  useAdhkarSessionStore.setState({session: null, revealToken: 0});
  // @ai-start
  mockPosition = {currentTime: 0, duration: 10};
  mockSeek.mockClear();
  // @ai-end
});

it('plays this card even while another list plays all', () => {
  useAdhkarSessionStore.getState().dispatch({
    type: 'pressPlayAll',
    source: {...src, listId: 'evening-adhkar'},
  });
  const renderer = renderCard('b');
  const button = renderer.root.find(
    node =>
      node.props.testID === 'adhkar-play-button' &&
      typeof node.props.onPress === 'function',
  );
  act(() => button.props.onPress());
  expect(useAdhkarSessionStore.getState().session).toMatchObject({
    listId: 'morning-adhkar',
    index: 1,
    mode: 'single',
  });
});

function rowHeight(renderer: ReactTestRenderer): unknown {
  const row = renderer.root.find(
    node =>
      node.props.testID === 'adhkar-progress-row' &&
      typeof node.type === 'string',
  );
  return StyleSheet.flatten(row.props.style).height;
}

it('reserves the same progress row height on current and other cards', () => {
  useAdhkarSessionStore.getState().dispatch({
    type: 'pressCard',
    source: src,
    index: 0,
  });
  const currentHeight = rowHeight(renderCard('a'));
  act(() => mounted?.unmount());
  const otherHeight = rowHeight(renderCard('b'));
  expect(typeof currentHeight).toBe('number');
  expect(currentHeight).toBeGreaterThan(0);
  expect(otherHeight).toBe(currentHeight);
});

// @ai-start
describe('progress bar of the session dhikr', () => {
  function slider(renderer: ReactTestRenderer) {
    return renderer.root.find(
      node =>
        node.props.maximumValue === 1 &&
        typeof node.props.onSlidingComplete === 'function' &&
        typeof node.type !== 'string',
    );
  }
  function pausedOn(dhikrIndex: number): void {
    const {dispatch} = useAdhkarSessionStore.getState();
    dispatch({type: 'pressCard', source: src, index: dhikrIndex});
    dispatch({type: 'toggle'});
  }

  it('shows the reported position and seeks within the clip length', () => {
    mockPosition = {currentTime: 30, duration: 40};
    pausedOn(0);
    const bar = slider(renderCard('a'));
    expect(bar.props.value).toBeCloseTo(0.75);
    expect(bar.props.disabled).toBe(false);
    act(() => {
      bar.props.onSlidingComplete(0.25);
    });
    expect(mockSeek).toHaveBeenCalledWith(10);
  });

  it('cannot be dragged while the clip length is unknown', () => {
    mockPosition = {currentTime: 0, duration: 0};
    pausedOn(0);
    const bar = slider(renderCard('a'));
    expect(bar.props.value).toBe(0);
    expect(bar.props.disabled).toBe(true);
  });

  it('stays off on a card that is not the session dhikr', () => {
    mockPosition = {currentTime: 30, duration: 40};
    pausedOn(0);
    const bar = slider(renderCard('b'));
    expect(bar.props.value).toBe(0);
    expect(bar.props.disabled).toBe(true);
  });
});

describe('Repeat before the dhikr plays', () => {
  function Card({dhikrId}: {dhikrId: string}): React.JSX.Element {
    return (
      <AdhkarAudioControls
        dhikrId={dhikrId}
        audioFile={`${dhikrId}.mp3`}
        onCopy={jest.fn()}
        onBookmark={jest.fn()}
        onShare={jest.fn()}
        onSettings={jest.fn()}
        isBookmarked={false}
      />
    );
  }

  const pages = (shown: string[]): React.JSX.Element => (
    <AdhkarSessionSourceProvider source={src}>
      {shown.map(id => (
        <Card key={id} dhikrId={id} />
      ))}
    </AdhkarSessionSourceProvider>
  );

  // The reader's pager keeps a few pages mounted and drops the rest.
  function renderPages(shown: string[]): ReactTestRenderer {
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(pages(shown));
    });
    if (!renderer) throw new Error('not rendered');
    mounted = renderer;
    return renderer;
  }

  function buttons(renderer: ReactTestRenderer, testID: string) {
    // Not deep: a touchable is two nested components with the same props.
    return renderer.root.findAll(
      node =>
        node.props.testID === testID &&
        typeof node.props.onPress === 'function',
      {deep: false},
    );
  }
  const repeatOn = (renderer: ReactTestRenderer, at = 0): unknown =>
    buttons(renderer, 'adhkar-repeat-button')[at].props.accessibilityState
      .selected;
  function press(renderer: ReactTestRenderer, testID: string, at = 0): void {
    act(() => {
      buttons(renderer, testID)[at].props.onPress();
    });
  }

  it('highlights when tapped with nothing playing, and Play then loops', () => {
    const renderer = renderPages(['a']);
    expect(repeatOn(renderer)).toBe(false);
    press(renderer, 'adhkar-repeat-button');
    expect(repeatOn(renderer)).toBe(true);
    expect(useAdhkarSessionStore.getState().session).toBeNull();

    press(renderer, 'adhkar-play-button');
    expect(useAdhkarSessionStore.getState().session).toMatchObject({
      index: 0,
      mode: 'single',
      loop: true,
    });
    expect(repeatOn(renderer)).toBe(true);
  });

  it('can be switched off again before Play', () => {
    const renderer = renderPages(['a']);
    press(renderer, 'adhkar-repeat-button');
    press(renderer, 'adhkar-repeat-button');
    expect(repeatOn(renderer)).toBe(false);
    press(renderer, 'adhkar-play-button');
    expect(useAdhkarSessionStore.getState().session?.loop).toBe(false);
  });

  it('follows the session once it plays, not the earlier tap', () => {
    const renderer = renderPages(['a']);
    press(renderer, 'adhkar-repeat-button');
    press(renderer, 'adhkar-play-button');
    // Switched off while it plays, then the session ends.
    press(renderer, 'adhkar-repeat-button');
    expect(useAdhkarSessionStore.getState().session?.loop).toBe(false);
    act(() => useAdhkarSessionStore.getState().dispatch({type: 'stop'}));
    expect(repeatOn(renderer)).toBe(false);
  });

  it('stays with its own dhikr when another page is shown', () => {
    const renderer = renderPages(['a', 'b']);
    press(renderer, 'adhkar-repeat-button', 0);
    expect(repeatOn(renderer, 0)).toBe(true);
    expect(repeatOn(renderer, 1)).toBe(false);

    // Play on the other dhikr does not take the armed Repeat with it.
    press(renderer, 'adhkar-play-button', 1);
    expect(useAdhkarSessionStore.getState().session).toMatchObject({
      index: 1,
      loop: false,
    });

    // The pager drops the armed page and brings it back.
    act(() => renderer.update(pages(['b'])));
    act(() => renderer.update(pages(['a', 'b'])));
    expect(repeatOn(renderer, 0)).toBe(true);
    press(renderer, 'adhkar-play-button', 0);
    expect(useAdhkarSessionStore.getState().session).toMatchObject({
      index: 0,
      mode: 'single',
      loop: true,
    });
  });

  it('is hidden on every card of a list that plays all', () => {
    useAdhkarSessionStore
      .getState()
      .dispatch({type: 'pressPlayAll', source: src});
    const renderer = renderPages(['a', 'b']);
    expect(buttons(renderer, 'adhkar-repeat-button')).toHaveLength(0);
  });

  it('shows while another list plays all', () => {
    useAdhkarSessionStore.getState().dispatch({
      type: 'pressPlayAll',
      source: {...src, listId: 'evening-adhkar'},
    });
    const renderer = renderPages(['a']);
    expect(buttons(renderer, 'adhkar-repeat-button')).toHaveLength(1);
  });
});
// @ai-end
