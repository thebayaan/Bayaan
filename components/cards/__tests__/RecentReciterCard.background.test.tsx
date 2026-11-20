// @ai-generated
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {AppState, type AppStateStatus} from 'react-native';
import {usePlayerStore} from '@/services/player/store/playerStore';

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      playback: {state: 'playing', position: 0, duration: 0},
      queue: {
        currentIndex: 0,
        tracks: [{reciterId: 'r1', surahId: '2', rewayatId: 'hafs'}],
      },
    })),
  };
});

// What the progress track shows, once for each render of the card.
const mockShown: number[] = [];
jest.mock('@/components/ProgressTrack', () => ({
  ProgressTrack: ({value}: {value: number}) => {
    mockShown.push(value);
    return null;
  },
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({updateQueue: jest.fn()}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({resumeChain: jest.fn()})},
}));
jest.mock('@/services/player/utils/resumeRecent', () => ({
  resumeRecent: jest.fn(),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({recitations: []})},
}));
jest.mock('@/utils/track', () => ({createUserUploadTrack: jest.fn()}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#000000',
        background: '#ffffff',
        border: '#cccccc',
        card: '#ffffff',
        shadow: '#000000',
        textSecondary: '#666666',
        primary: '#000000',
      },
    },
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({
  USE_GLASS: false,
  useGlassColorScheme: () => 'light',
}));
jest.mock('expo-glass-effect', () => ({GlassView: 'GlassView'}));
jest.mock('expo-linear-gradient', () => ({LinearGradient: 'LinearGradient'}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/Icons', () => ({PlayIcon: () => null}));
jest.mock('@/components/NowPlayingIndicator', () => ({
  NowPlayingIndicator: () => null,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({push: jest.fn()}),
  Link: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));
jest.mock('@/components/sheets/options/OptionsMenu', () => ({
  useNativeOptionsMenu: () => null,
}));
jest.mock('@/components/sheets/options/homeCardOptions', () => ({
  HomeCardOptionsMenu: () => null,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: {value?: number}) => `${key}:${opts?.value}`,
  }),
}));

import {RecentReciterCard} from '../RecentReciterCard';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const store = usePlayerStore as unknown as {
  setState: (fn: (s: {playback: object}) => object) => void;
};
const appState = AppState as unknown as {currentState: AppStateStatus};

function changeAppState(next: AppStateStatus) {
  act(() => {
    appState.currentState = next;
    (AppState.addEventListener as jest.Mock).mock.calls
      .filter(([type]) => type === 'change')
      .forEach(([, listener]) => listener(next));
  });
}

/** One provider tick: what ExpoAudioProvider writes every 2 s on Android. */
function tick(position: number, duration = 600) {
  act(() => {
    store.setState(s => ({playback: {...s.playback, position, duration}}));
  });
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

function timeText(): string {
  if (!renderer) throw new Error('not rendered');
  const texts = renderer.root.findAll(
    node => (node.type as unknown) === 'Text',
  );
  return String(texts[texts.length - 1].props.children);
}

beforeEach(() => {
  appState.currentState = 'active';
  tick(60);
  mockShown.length = 0;
  act(() => {
    renderer = TestRenderer.create(
      <RecentReciterCard
        reciterName="Reciter"
        surahName="Al-Baqarah"
        trackId="r1:2"
        reciterId="r1"
        surahId={2}
        rewayatId="hafs"
        progress={0.1}
        duration={600}
      />,
    );
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  (AppState.addEventListener as jest.Mock).mockClear();
});

const last = () => mockShown[mockShown.length - 1];

describe('RecentReciterCard in the background', () => {
  it('follows the position while the app is in the foreground', () => {
    expect(last()).toBeCloseTo(0.1);
    tick(300);
    expect(last()).toBeCloseTo(0.5);
    expect(timeText()).toBe('duration.minutes:5');
  });

  it('does not render on a position tick in the background', () => {
    changeAppState('background');
    const renders = mockShown.length;
    tick(120);
    tick(180);
    tick(240);
    expect(mockShown.length).toBe(renders);
    expect(last()).toBeCloseTo(0.1);
  });

  it('shows the live position on return', () => {
    changeAppState('background');
    tick(120);
    tick(420);
    changeAppState('active');
    expect(last()).toBeCloseTo(0.7);
    expect(timeText()).toBe('duration.minutes:3');
  });

  it('still updates while inactive (on screen)', () => {
    changeAppState('inactive');
    tick(300);
    expect(last()).toBeCloseTo(0.5);
  });
});
