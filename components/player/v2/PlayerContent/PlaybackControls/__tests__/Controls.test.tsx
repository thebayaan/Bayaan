// @ai-generated
// The phone player's transport row: back 15, previous, play / pause, next,
// forward 15.
import React from 'react';
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
