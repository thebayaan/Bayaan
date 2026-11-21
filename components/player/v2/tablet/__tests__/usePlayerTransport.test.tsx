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
const mockSeekBy = jest.fn().mockResolvedValue(undefined);
jest.mock('../../seekBy', () => ({
  seekBy: (seconds: number) => mockSeekBy(seconds),
}));
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

describe('back and forward 15 seconds', () => {
  // seekBy() works from the player's own clock (see seekBy.test.ts); the
  // buttons no longer add 15 to the progress shown, which can be stale.
  it('jumps relative to where the audio is', async () => {
    mockProgress.position = 100;
    const transport = mountTransport();
    await act(async () => {
      await transport().seekForward();
    });
    expect(mockSeekBy).toHaveBeenLastCalledWith(15);
    await act(async () => {
      await transport().seekBack();
    });
    expect(mockSeekBy).toHaveBeenLastCalledWith(-15);
    expect(mockActions.seekTo).not.toHaveBeenCalled();
  });

  it('does nothing while a track loads', async () => {
    setPlayer({state: 'loading', trackLoading: true});
    const transport = mountTransport();
    await act(async () => {
      await transport().seekForward();
      await transport().seekBack();
    });
    expect(mockSeekBy).not.toHaveBeenCalled();
  });
});

describe('next', () => {
  // `isLastTrack` is what greys Next out (PlayerParts.test.tsx).
  it('has nowhere to go from the last track', async () => {
    const transport = mountTransport();
    expect(transport().isLastTrack).toBe(false);

    setPlayer({currentIndex: 2});
    expect(transport().isLastTrack).toBe(true);
    await act(async () => {
      await transport().next();
    });
    expect(mockActions.skipToNext).not.toHaveBeenCalled();

    // Repeat One does not wrap either: the store's next does nothing there.
    setPlayer({currentIndex: 2, repeatMode: 'track'});
    expect(transport().isLastTrack).toBe(true);
  });

  // The end of a track and Previous both wrap with Repeat All; Next was
  // greyed out all the same.
  it('wraps to the first track with Repeat All', async () => {
    setPlayer({currentIndex: 2, repeatMode: 'queue'});
    const transport = mountTransport();
    expect(transport().isLastTrack).toBe(false);
    await act(async () => {
      await transport().next();
    });
    expect(mockActions.skipToNext).toHaveBeenCalledTimes(1);
  });
});
