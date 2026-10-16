import React from 'react';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {AdhkarNowPlayingCard} from '@/components/adhkar/AdhkarNowPlayingCard';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

const mockDispatch = jest.fn();
jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => ({dispatch: mockDispatch}),
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      fonts: {regular: 'r', medium: 'm', semiBold: 's'},
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        card: '#ffffff',
        background: '#ffffff',
        border: '#eeeeee',
        shadow: '#000000',
      },
    },
  }),
}));

jest.mock('@/hooks/useGlassProps', () => ({
  USE_GLASS: false,
  useGlassColorScheme: () => 'light',
}));

const mockShowSheet = jest.fn();
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    show: (...args: unknown[]) => mockShowSheet(...args),
    hide: jest.fn(),
  },
}));

jest.mock('@expo/vector-icons', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {Feather: MockView, Ionicons: MockView};
});
jest.mock('@/components/Icons', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    PlayIcon: () => <MockView testID="icon-play" />,
    PauseIcon: () => <MockView testID="icon-pause" />,
  };
});
jest.mock('@/components/NowPlayingIndicator', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    NowPlayingIndicator: (props: {isPlaying: boolean}) => (
      <MockView testID="now-playing-indicator" {...props} />
    ),
  };
});
jest.mock('@/components/FrostedView', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {FrostedView: MockView};
});
jest.mock('expo-image', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {Image: MockView};
});
jest.mock('expo-linear-gradient', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {LinearGradient: MockView};
});
jest.mock('expo-glass-effect', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {GlassView: MockView};
});
jest.mock('@miblanchard/react-native-slider', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    Slider: (props: {value: number}) => (
      <MockView testID="adhkar-session-progress" value={props.value} />
    ),
  };
});
jest.mock('@/services/adhkar/playback/sessionPersistence', () => ({
  dropStaleSession: jest.fn(),
}));

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
}));

jest.mock('@/services/adhkar/playback/openPlayingDhikr', () => ({
  openPlayingDhikr: (navigation: {dispatch: (a: string) => void}) => {
    navigation.dispatch('open');
    return true;
  },
}));

const items = ['a', 'b', 'c', 'd'].map(id => ({
  dhikrId: id,
  audioFile: `${id}.mp3`,
  playable: true,
  preview: id,
}));

const session: AdhkarSession = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items,
  index: 1,
  mode: 'all',
  loop: false,
  status: 'playing',
  error: false,
  trackToken: 1,
  positionSec: 0,
  lastActiveAt: Date.now(),
};

function texts(r: ReactTestRenderer): string[] {
  return r.root
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => [n.props.children].flat().join(''));
}

function has(r: ReactTestRenderer, id: string): boolean {
  return r.root.findAll(n => n.props.testID === id).length > 0;
}

function press(r: ReactTestRenderer, id: string, prop = 'onPress'): void {
  act(() => {
    r.root.findByProps({testID: id}).props[prop]();
  });
}

function setSession(next: AdhkarSession | null): void {
  act(() => {
    useAdhkarSessionStore.setState({session: next});
  });
}

let renderer: ReactTestRenderer | null = null;

function mount(variant: 'tile' | 'row'): ReactTestRenderer {
  act(() => {
    renderer = TestRenderer.create(<AdhkarNowPlayingCard variant={variant} />);
  });
  if (!renderer) throw new Error('render failed');
  return renderer;
}

beforeEach(() => {
  mockDispatch.mockClear();
  mockShowSheet.mockClear();
  act(() => {
    useAdhkarSessionStore.setState({session: null, revealToken: 0});
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('renders nothing without a session', () => {
  expect(mount('tile').toJSON()).toBeNull();
  act(() => renderer?.unmount());
  expect(mount('row').toJSON()).toBeNull();
});

describe('Continue Listening card', () => {
  beforeEach(() => setSession(session));

  it('shows the illustration, title, position and remaining rows', () => {
    const r = mount('tile');
    expect(has(r, 'adhkar-session-card')).toBe(true);
    expect(has(r, 'adhkar-session-artwork-image')).toBe(true);
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Morning Adhkar', 'Dhikr 2 of 4', '2 left']),
    );
  });

  it('shows progress through the list', () => {
    const r = mount('tile');
    expect(
      r.root.findByProps({testID: 'adhkar-session-progress'}).props.value,
    ).toBe(0.5);
  });

  it('uses the neutral tile for Saved', () => {
    setSession({...session, listId: 'saved', listTitle: 'Saved'});
    const r = mount('tile');
    expect(has(r, 'adhkar-session-artwork-image')).toBe(false);
    expect(has(r, 'adhkar-session-artwork-fallback')).toBe(true);
  });

  it('shows the indicator and a pause icon while playing, a play icon while paused', () => {
    const r = mount('tile');
    expect(has(r, 'now-playing-indicator')).toBe(true);
    expect(has(r, 'icon-pause')).toBe(true);
    setSession({...session, status: 'paused'});
    expect(has(r, 'now-playing-indicator')).toBe(false);
    expect(has(r, 'icon-play')).toBe(true);
  });

  it('toggles from the playback zone', () => {
    const r = mount('tile');
    press(r, 'adhkar-now-playing-toggle');
    expect(useAdhkarSessionStore.getState().session?.status).toBe('paused');
    press(r, 'adhkar-now-playing-toggle');
    expect(useAdhkarSessionStore.getState().session?.status).toBe('loading');
  });

  it('opens the playing dhikr from the body', () => {
    const r = mount('tile');
    press(r, 'adhkar-now-playing-open');
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('opens the stop sheet on long press and keeps the session', () => {
    const r = mount('tile');
    press(r, 'adhkar-now-playing-open', 'onLongPress');
    expect(mockShowSheet).toHaveBeenCalledWith('adhkar-session-options', {
      payload: {title: 'Morning Adhkar', subtitle: 'Dhikr 2 of 4'},
    });
    press(r, 'adhkar-now-playing-toggle', 'onLongPress');
    expect(mockShowSheet).toHaveBeenCalledTimes(2);
    expect(useAdhkarSessionStore.getState().session).not.toBeNull();
  });

  it('has no close button', () => {
    expect(has(mount('tile'), 'adhkar-now-playing-close')).toBe(false);
  });
});

describe('Adhkar screen player', () => {
  beforeEach(() => setSession(session));

  it('shows the artwork, title and position', () => {
    const r = mount('row');
    expect(has(r, 'adhkar-session-player')).toBe(true);
    expect(has(r, 'adhkar-session-artwork-image')).toBe(true);
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Morning Adhkar', 'Dhikr 2 of 4']),
    );
  });

  it('toggles play and pause', () => {
    const r = mount('row');
    expect(has(r, 'icon-pause')).toBe(true);
    press(r, 'adhkar-now-playing-toggle');
    expect(useAdhkarSessionStore.getState().session?.status).toBe('paused');
    expect(has(r, 'icon-play')).toBe(true);
  });

  it('opens the playing dhikr from the body', () => {
    const r = mount('row');
    press(r, 'adhkar-now-playing-open');
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('ends the session from the close button', () => {
    const r = mount('row');
    press(r, 'adhkar-now-playing-close');
    expect(useAdhkarSessionStore.getState().session).toBeNull();
    expect(r.toJSON()).toBeNull();
  });
});
