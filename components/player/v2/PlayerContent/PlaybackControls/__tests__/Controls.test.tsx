// @ai-generated
// The phone player's transport row: back 15, previous, play / pause, next,
// forward 15.
import React from 'react';
import {StyleSheet} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111111', textSecondary: '#666666'}},
  }),
}));
const mockActions = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  skipToNext: jest.fn().mockResolvedValue(undefined),
  skipToPrevious: jest.fn().mockResolvedValue(undefined),
  seekTo: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => mockActions,
}));
jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {usePlayerStore: create(() => ({}))};
});
const mockSeekBy = jest.fn().mockResolvedValue(undefined);
jest.mock('@/components/player/v2/seekBy', () => ({
  seekBy: (seconds: number) => mockSeekBy(seconds),
}));
jest.mock('@/components/Icons', () => ({
  PlayIcon: () => null,
  PauseIcon: () => null,
  PreviousIcon: () => null,
  NextIcon: () => null,
  SeekForwardIcon: () => null,
  SeekBackwardIcon: () => null,
}));

import {usePlayerStore} from '@/services/player/store/playerStore';
import {PauseIcon, PlayIcon} from '@/components/Icons';
import {Controls} from '../Controls';

type Renderer = TestRenderer.ReactTestRenderer;

interface PlayerSetup {
  state?: string;
  position?: number;
  trackLoading?: boolean;
  currentIndex?: number;
  tracks?: number;
  repeatMode?: 'none' | 'queue' | 'track';
}

function setPlayer({
  state = 'paused',
  position = 0,
  trackLoading = false,
  currentIndex = 0,
  tracks = 3,
  repeatMode = 'none',
}: PlayerSetup = {}) {
  act(() => {
    usePlayerStore.setState({
      playback: {state, position},
      queue: {
        tracks: Array.from({length: tracks}, (_, i) => ({id: `t${i}`})),
        currentIndex,
      },
      loading: {trackLoading},
      settings: {repeatMode},
    } as never);
  });
}

function mount(): Renderer {
  let renderer!: Renderer;
  act(() => {
    renderer = TestRenderer.create(<Controls />);
  });
  return renderer;
}

/** The innermost Pressable with this accessibility label. */
function button(r: Renderer, label: string) {
  const all = r.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === label,
  );
  return all[all.length - 1];
}

const shows = (r: Renderer, icon: unknown) =>
  r.root.findAll(n => (n.type as unknown) === icon).length > 0;

async function press(r: Renderer, label: string) {
  await act(async () => {
    await button(r, label).props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setPlayer();
});

describe('play / pause', () => {
  it('plays when paused and pauses when playing', async () => {
    const r = mount();
    expect(shows(r, PlayIcon)).toBe(true);
    await press(r, 'Play');
    expect(mockActions.play).toHaveBeenCalledTimes(1);

    setPlayer({state: 'playing'});
    expect(shows(r, PauseIcon)).toBe(true);
    await press(r, 'Pause');
    expect(mockActions.pause).toHaveBeenCalledTimes(1);
  });

  // On iOS a stalled stream reports 'buffering' and carries on by itself.
  // The button used to show Play there, and the first tap called play().
  it('shows Pause and pauses on the first tap while the stream is stalled', async () => {
    setPlayer({state: 'playing'});
    const r = mount();
    setPlayer({state: 'buffering'});
    expect(shows(r, PauseIcon)).toBe(true);
    await press(r, 'Pause');
    expect(mockActions.pause).toHaveBeenCalledTimes(1);
    expect(mockActions.play).not.toHaveBeenCalled();
  });
});

describe('back and forward 15 seconds', () => {
  // seekBy() works from the player's own clock (see seekBy.test.ts); the
  // buttons no longer add 15 to the position the store last saved.
  it('jumps relative to where the audio is', async () => {
    setPlayer({state: 'playing', position: 100});
    const r = mount();
    await press(r, 'Forward 15 seconds');
    expect(mockSeekBy).toHaveBeenLastCalledWith(15);
    await press(r, 'Back 15 seconds');
    expect(mockSeekBy).toHaveBeenLastCalledWith(-15);
    expect(mockActions.seekTo).not.toHaveBeenCalled();
  });

  it('does nothing while a track loads', async () => {
    setPlayer({state: 'loading', trackLoading: true});
    const r = mount();
    await press(r, 'Forward 15 seconds');
    await press(r, 'Back 15 seconds');
    expect(mockSeekBy).not.toHaveBeenCalled();
  });
});

describe('next', () => {
  const next = (r: Renderer) => button(r, 'Next');
  const dimmed = (r: Renderer) =>
    StyleSheet.flatten(next(r).props.style).opacity === 0.5;

  it('goes to the next track', async () => {
    const r = mount();
    expect(next(r).props.disabled).toBe(false);
    expect(dimmed(r)).toBe(false);
    await press(r, 'Next');
    expect(mockActions.skipToNext).toHaveBeenCalledTimes(1);
  });

  it('is greyed out on the last track', async () => {
    setPlayer({currentIndex: 2});
    const r = mount();
    expect(next(r).props.disabled).toBe(true);
    expect(dimmed(r)).toBe(true);
    await press(r, 'Next');
    expect(mockActions.skipToNext).not.toHaveBeenCalled();

    // Repeat One does not wrap either: the store's next does nothing there.
    setPlayer({currentIndex: 2, repeatMode: 'track'});
    expect(next(r).props.disabled).toBe(true);
  });

  // The end of a track and Previous both wrap with Repeat All; Next was
  // greyed out all the same.
  it('wraps to the first track with Repeat All', async () => {
    setPlayer({currentIndex: 2, repeatMode: 'queue'});
    const r = mount();
    expect(next(r).props.disabled).toBe(false);
    expect(dimmed(r)).toBe(false);
    await press(r, 'Next');
    expect(mockActions.skipToNext).toHaveBeenCalledTimes(1);
  });

  it('is greyed out while a track loads, like Previous', () => {
    setPlayer({state: 'loading', trackLoading: true});
    const r = mount();
    expect(next(r).props.disabled).toBe(true);
    expect(dimmed(r)).toBe(true);
    expect(next(r).props.accessibilityState).toEqual({disabled: true});
  });
});
