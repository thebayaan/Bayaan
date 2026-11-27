// @ai-generated
// The play button of the three mini players: the iOS tab accessory
// (MiniPlayer), the Android pill (FloatingPlayer) and the iPad sidebar dock
// (TabletDockedPlayer). They share one behaviour, so they share these tests.
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111111', textSecondary: '#666666'}},
  }),
}));
const mockPlay = jest.fn().mockResolvedValue(undefined);
const mockPause = jest.fn().mockResolvedValue(undefined);
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({play: mockPlay, pause: mockPause}),
}));
jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      playback: {state: 'paused'},
      queue: {tracks: [{id: 'r1-2', reciterName: 'Reciter'}], currentIndex: 0},
      loading: {trackLoading: false, stateRestoring: false},
    })),
  };
});
jest.mock('@/services/player/sheetRef', () => ({expandPlayerSheet: jest.fn()}));
jest.mock('@/components/player/v2/useMiniPlayerAnchor', () => ({
  useMiniPlayerAnchor: () => ({anchorRef: {current: null}, openGesture: {}}),
}));
jest.mock('react-native-gesture-handler', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    GestureDetector: ({children}: {children: React.ReactNode}) => children,
    GestureHandlerRootView: MockView,
  };
});
jest.mock('@/components/Icons', () => ({
  PlayIcon: () => null,
  PauseIcon: () => null,
}));
jest.mock('@/components/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/FrostedView', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {FrostedView: MockView};
});
jest.mock('@/hooks/useGlassProps', () => ({
  useGlassTint: () => undefined,
  USE_GLASS: false,
  useGlassColorScheme: () => 'light',
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));
jest.mock('expo-router', () => ({usePathname: () => '/'}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/i18n/format', () => ({
  getTrackDisplayTitle: () => 'Al-Baqarah',
  getTrackArtistDisplay: () => 'Reciter',
}));

import {usePlayerStore} from '@/services/player/store/playerStore';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {MiniPlayer} from '../MiniPlayer';
import {FloatingPlayer} from '../FloatingPlayer';
import {TabletDockedPlayer} from '@/components/tablet/TabletDockedPlayer';

type Renderer = TestRenderer.ReactTestRenderer;

function setPlayer(state: string, trackLoading = false) {
  act(() => {
    usePlayerStore.setState({
      playback: {state},
      loading: {trackLoading, stateRestoring: false},
    } as never);
  });
}

function mount(element: React.JSX.Element): Renderer {
  let renderer!: Renderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

/** The play / pause button: the innermost Pressable with that label. */
function playButton(r: Renderer) {
  const all = r.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      ['Play', 'Pause'].includes(n.props.accessibilityLabel),
  );
  return all[all.length - 1];
}

const shows = (r: Renderer, icon: unknown) =>
  r.root.findAll(n => (n.type as unknown) === icon).length > 0;

async function tap(r: Renderer) {
  await act(async () => {
    await playButton(r).props.onPress();
  });
}

const players: [string, () => React.JSX.Element][] = [
  ['MiniPlayer', () => <MiniPlayer />],
  ['FloatingPlayer', () => <FloatingPlayer />],
  ['TabletDockedPlayer', () => <TabletDockedPlayer expanded />],
];

describe.each(players)('%s play button', (_name, element) => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlayer('paused');
  });

  it('plays when paused and pauses when playing', async () => {
    const r = mount(element());
    expect(shows(r, PlayIcon)).toBe(true);
    await tap(r);
    expect(mockPlay).toHaveBeenCalledTimes(1);

    setPlayer('playing');
    expect(shows(r, PauseIcon)).toBe(true);
    await tap(r);
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  // The track on screen is loaded again: a replay after it ended, or the
  // same surah in another rewayah (same track id). The old flag only spun
  // when the track id had just changed.
  it('spins for the whole load, also when the same track loads again', () => {
    const r = mount(element());
    setPlayer('loading', true);
    expect(shows(r, LoadingIndicator)).toBe(true);
    expect(shows(r, PlayIcon)).toBe(false);

    // Any re-render during the load keeps the spinner.
    setPlayer('loading', true);
    expect(shows(r, LoadingIndicator)).toBe(true);

    setPlayer('playing');
    expect(shows(r, LoadingIndicator)).toBe(false);
    expect(shows(r, PauseIcon)).toBe(true);
  });

  it('does not spin for a plain play or pause', () => {
    const r = mount(element());
    // play() and pause() raise trackLoading for a moment; no load runs.
    setPlayer('paused', true);
    expect(shows(r, LoadingIndicator)).toBe(false);
    setPlayer('playing', true);
    expect(shows(r, LoadingIndicator)).toBe(false);
  });

  // On iOS a stalled stream reports 'buffering' and carries on by itself.
  // The button used to read as Play there, and the first tap called play().
  it('pauses on a tap while the stream is stalled', async () => {
    const r = mount(element());
    setPlayer('buffering');
    expect(shows(r, LoadingIndicator)).toBe(true);
    expect(playButton(r).props.accessibilityLabel).toBe('Pause');
    await tap(r);
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('ignores a tap while the track loads', async () => {
    const r = mount(element());
    setPlayer('loading', true);
    await tap(r);
    expect(mockPlay).not.toHaveBeenCalled();
    expect(mockPause).not.toHaveBeenCalled();
    expect(playButton(r).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});
