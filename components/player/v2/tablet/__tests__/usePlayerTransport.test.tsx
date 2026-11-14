// @ai-generated
// The iPad player's transport logic (the buttons are covered in
// PlayerParts.test.tsx).
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

const mockActions = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  skipToNext: jest.fn().mockResolvedValue(undefined),
  skipToPrevious: jest.fn().mockResolvedValue(undefined),
  seekTo: jest.fn().mockResolvedValue(undefined),
  updateSettings: jest.fn(),
};
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => mockActions,
}));
jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {usePlayerStore: create(() => ({}))};
});
const mockProgress = {
  position: 0,
  duration: 0,
  seekPosition: null as number | null,
  setPosition: jest.fn(),
};
jest.mock('@/services/player/store/progressStore', () => ({
  useProgress: () => mockProgress,
}));

import {usePlayerStore} from '@/services/player/store/playerStore';
import {usePlayerTransport, type PlayerTransport} from '../usePlayerTransport';

interface PlayerSetup {
  state?: string;
  trackLoading?: boolean;
  currentIndex?: number;
  tracks?: number;
  repeatMode?: 'none' | 'queue' | 'track';
}

function setPlayer({
  state = 'paused',
  trackLoading = false,
  currentIndex = 0,
  tracks = 3,
  repeatMode = 'none',
}: PlayerSetup = {}) {
  act(() => {
    usePlayerStore.setState({
      playback: {state, rate: 1},
      queue: {
        tracks: Array.from({length: tracks}, (_, i) => ({id: `t${i}`})),
        currentIndex,
      },
      loading: {trackLoading},
      settings: {repeatMode, sleepTimerEnd: null},
    } as never);
  });
}

/** Mounts the hook; `current()` is its latest result. */
function mountTransport(): () => PlayerTransport {
  let latest!: PlayerTransport;
  function Probe(): null {
    latest = usePlayerTransport();
    return null;
  }
  act(() => {
    TestRenderer.create(<Probe />);
  });
  return () => latest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProgress.position = 0;
  mockProgress.duration = 0;
  setPlayer();
});

describe('play / pause', () => {
  it('plays when paused and pauses when playing', async () => {
    const transport = mountTransport();
    expect(transport().isPlaying).toBe(false);
    await act(async () => {
      await transport().togglePlay();
    });
    expect(mockActions.play).toHaveBeenCalledTimes(1);

    setPlayer({state: 'playing'});
    expect(transport().isPlaying).toBe(true);
    await act(async () => {
      await transport().togglePlay();
    });
    expect(mockActions.pause).toHaveBeenCalledTimes(1);
  });

  // On iOS a stalled stream reports 'buffering' and carries on by itself.
  // The button used to show Play there, and the first tap called play().
  it('stays on Pause and pauses on the first tap while the stream is stalled', async () => {
    setPlayer({state: 'playing'});
    const transport = mountTransport();
    setPlayer({state: 'buffering'});
    expect(transport().isPlaying).toBe(true);
    await act(async () => {
      await transport().togglePlay();
    });
    expect(mockActions.pause).toHaveBeenCalledTimes(1);
    expect(mockActions.play).not.toHaveBeenCalled();
  });
});
