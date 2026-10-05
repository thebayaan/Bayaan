/**
 * Characterization tests for AudioCoordinator — Group B from
 * bayaan-platform/planning/Characterization-Test-Plan.md.
 *
 * Locks in mutual-exclusion behavior between the main player and the mushaf
 * player BEFORE the RFC-008 refactor that replaces the lazy-`require()`
 * pattern with `CoordinatorHooks` injection. Tests-only — zero production
 * code touched.
 *
 * The lazy `require('./MushafAudioService')` and `require('@/store/mushafPlayerStore')`
 * inside `mainWillPlay()` are characterized here (B2, B4) so the refactor PR
 * can prove behavior parity by keeping these tests green.
 *
 * See docs/rfcs/006-audio-characterization-tests-group-b.md.
 */

// Mock the eagerly-imported player store at the top level so AudioCoordinator's
// `import {usePlayerStore}` resolves to our spy. Lazy-required modules are
// mocked the same way — jest hoists `jest.mock` so the require() inside
// `mainWillPlay()` picks up the mock.
//
// Variables referenced from inside `jest.mock(...)` factories must be named
// `mock*` (case insensitive) — babel-jest's hoist guard allows that prefix.
const mockMainPause = jest.fn(() => Promise.resolve());
const mockMushafSetPlaybackState = jest.fn();
const mockMushafServicePause = jest.fn();
const mockMushafServiceGetIsPlaying = jest.fn(() => true);

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: jest.fn(() => ({
      playback: {state: 'playing'},
      pause: mockMainPause,
    })),
  },
}));

jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {
    getState: jest.fn(() => ({
      playbackState: 'playing',
      setPlaybackState: mockMushafSetPlaybackState,
    })),
  },
}));

jest.mock('../MushafAudioService', () => ({
  mushafAudioService: {
    pause: mockMushafServicePause,
    getIsPlaying: mockMushafServiceGetIsPlaying,
  },
}));

import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';

/**
 * Helper: re-import AudioCoordinator with a fresh module registry so the
 * private `activeSource` field starts at `'none'` for every test. The
 * coordinator is a singleton with no public reset method — `jest.isolateModules`
 * is the surgical way to get a clean instance without modifying production
 * code (which would violate Tidy First for a tests-only PR).
 */
function freshCoordinator(): typeof import('../AudioCoordinator').audioCoordinator {
  let instance!: typeof import('../AudioCoordinator').audioCoordinator;
  jest.isolateModules(() => {
    instance = require('../AudioCoordinator').audioCoordinator;
  });
  return instance;
}

describe('AudioCoordinator — Group B characterization', () => {
  beforeEach(() => {
    mockMainPause.mockClear();
    mockMushafSetPlaybackState.mockClear();
    mockMushafServicePause.mockClear();
    mockMushafServiceGetIsPlaying.mockClear();
    mockMushafServiceGetIsPlaying.mockReturnValue(true);
    (usePlayerStore.getState as jest.Mock).mockReturnValue({
      playback: {state: 'playing'},
      pause: mockMainPause,
    });
    (useMushafPlayerStore.getState as jest.Mock).mockReturnValue({
      playbackState: 'playing',
      setPlaybackState: mockMushafSetPlaybackState,
    });
  });

  // ---------------------------------------------------------------- B1 ---
  // NOTE: the Plan's prose for B1 swapped the method/store pairing. The
  // actual code path that touches `usePlayerStore.getState().pause()` is
  // `mushafWillPlay()` (mushaf is starting → pause main). Locking in the
  // real behavior, not the prose.
  it('B1: mushafWillPlay() pauses the main player only when activeSource === "main" and main is playing/buffering', () => {
    // From a clean coordinator (activeSource = 'none'): no pause.
    const c1 = freshCoordinator();
    c1.mushafWillPlay();
    expect(mockMainPause).not.toHaveBeenCalled();
    expect(c1.getActiveSource()).toBe('mushaf');

    // activeSource = 'main', main is 'playing' → pause.
    const c2 = freshCoordinator();
    c2.mainWillPlay();
    expect(c2.getActiveSource()).toBe('main');
    mockMainPause.mockClear();
    c2.mushafWillPlay();
    expect(mockMainPause).toHaveBeenCalledTimes(1);
    expect(c2.getActiveSource()).toBe('mushaf');

    // activeSource = 'main', main is 'paused' → no pause (state guard).
    const c3 = freshCoordinator();
    c3.mainWillPlay();
    (usePlayerStore.getState as jest.Mock).mockReturnValueOnce({
      playback: {state: 'paused'},
      pause: mockMainPause,
    });
    mockMainPause.mockClear();
    c3.mushafWillPlay();
    expect(mockMainPause).not.toHaveBeenCalled();
    expect(c3.getActiveSource()).toBe('mushaf');

    // activeSource = 'main', main is 'buffering' → pause (buffering counts as active).
    const c4 = freshCoordinator();
    c4.mainWillPlay();
    (usePlayerStore.getState as jest.Mock).mockReturnValueOnce({
      playback: {state: 'buffering'},
      pause: mockMainPause,
    });
    mockMainPause.mockClear();
    c4.mushafWillPlay();
    expect(mockMainPause).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------- B2 ---
  it('B2: mainWillPlay() pauses mushaf via lazy-required mushafAudioService AND sets mushaf store to "paused"', () => {
    const c = freshCoordinator();

    // Get into activeSource = 'mushaf' first.
    c.mushafWillPlay();
    expect(c.getActiveSource()).toBe('mushaf');

    // Lazy require + pause path.
    c.mainWillPlay();

    expect(mockMushafServiceGetIsPlaying).toHaveBeenCalledTimes(1);
    expect(mockMushafServicePause).toHaveBeenCalledTimes(1);
    expect(mockMushafSetPlaybackState).toHaveBeenCalledWith('paused');
    expect(c.getActiveSource()).toBe('main');
  });

  // ---------------------------------------------------------------- B3 ---
  it('B3: sourceDidStop("mushaf") followed by mainWillPlay() triggers no pause (clean handoff, no recursion)', () => {
    const c = freshCoordinator();

    c.mushafWillPlay();
    expect(c.getActiveSource()).toBe('mushaf');

    c.sourceDidStop('mushaf');
    expect(c.getActiveSource()).toBe('none');

    mockMushafServicePause.mockClear();
    mockMushafSetPlaybackState.mockClear();

    c.mainWillPlay();

    // No pause-mushaf path because activeSource was already 'none'.
    expect(mockMushafServiceGetIsPlaying).not.toHaveBeenCalled();
    expect(mockMushafServicePause).not.toHaveBeenCalled();
    expect(mockMushafSetPlaybackState).not.toHaveBeenCalled();
    expect(c.getActiveSource()).toBe('main');
  });

  // ---------------------------------------------------------------- B4 ---
  // Smoke test for the lazy-`require()` hack that the RFC-008 refactor will
  // delete. Confirms the require resolves at function-call time without
  // throwing a synchronous-import-cycle error. After the refactor, this
  // test is expected to be deleted (the code path it covers no longer exists).
  it('B4: mainWillPlay() lazy-require resolves without throwing (baseline before RFC-008 deletion)', () => {
    const c = freshCoordinator();
    c.mushafWillPlay();

    // mushaf is "playing" per the default mock — the lazy-require path runs
    // end to end. The assertion is "does not throw", plus confirmation that
    // both lazy-required exports were actually consumed.
    expect(() => c.mainWillPlay()).not.toThrow();
    expect(mockMushafServiceGetIsPlaying).toHaveBeenCalledTimes(1);
    expect(mockMushafSetPlaybackState).toHaveBeenCalledTimes(1);

    // Also confirm the activeSource transitioned, proving the function
    // ran past the lazy-require block (didn't bail at a require error).
    expect(c.getActiveSource()).toBe('main');
  });
});
