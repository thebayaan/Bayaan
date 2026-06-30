import {useOverlayStore, clampSpeed, getPersistedSpeed} from './overlayStore';
import {useTVPlayerStore} from './tvPlayerStore';
import type {AudioEngine, EngineEvent} from '../services/audioEngine';
import {storage} from '../services/storage';

function makeMockEngine(): AudioEngine & {emit: (e: EngineEvent) => void} {
  let listener: ((e: EngineEvent) => void) | null = null;
  return {
    load: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    seek: jest.fn(),
    setRate: jest.fn(),
    destroy: jest.fn(),
    subscribe: cb => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
    emit: e => listener?.(e),
  };
}

beforeEach(() => {
  storage.clearAll();
  useOverlayStore.getState().reset();
  useTVPlayerStore.getState().reset();
});

describe('overlayStore', () => {
  describe('open/close', () => {
    it('starts with no active overlay', () => {
      expect(useOverlayStore.getState().active).toBeNull();
    });

    it('open sets the active overlay key', () => {
      useOverlayStore.getState().open('speed');
      expect(useOverlayStore.getState().active).toBe('speed');
    });

    it('opening a second overlay replaces the first (one at a time)', () => {
      useOverlayStore.getState().open('speed');
      useOverlayStore.getState().open('sleep');
      expect(useOverlayStore.getState().active).toBe('sleep');
    });

    it('close clears the active overlay', () => {
      useOverlayStore.getState().open('ambient');
      useOverlayStore.getState().close();
      expect(useOverlayStore.getState().active).toBeNull();
    });
  });

  describe('clampSpeed', () => {
    it('clamps above max to 2', () => {
      expect(clampSpeed(3)).toBe(2);
    });

    it('clamps below min to 0.5', () => {
      expect(clampSpeed(0.1)).toBe(0.5);
    });

    it('passes a valid rate through unchanged', () => {
      expect(clampSpeed(1.25)).toBe(1.25);
    });

    it('falls back to 1 for non-finite input', () => {
      expect(clampSpeed(Number.NaN)).toBe(1);
    });
  });

  describe('applySpeed', () => {
    it('applies the rate to the live engine via tvPlayerStore', () => {
      const engine = makeMockEngine();
      useTVPlayerStore.getState().setEngine(engine);
      useOverlayStore.getState().applySpeed(1.5);
      expect(engine.setRate).toHaveBeenCalledWith(1.5);
      expect(useTVPlayerStore.getState().speed).toBe(1.5);
    });

    it('stores the applied speed in overlay state', () => {
      useOverlayStore.getState().applySpeed(1.25);
      expect(useOverlayStore.getState().speed).toBe(1.25);
    });

    it('persists the applied speed across re-reads (MMKV)', () => {
      useOverlayStore.getState().applySpeed(0.75);
      expect(getPersistedSpeed()).toBe(0.75);
    });

    it('clamps an out-of-range rate before applying', () => {
      const engine = makeMockEngine();
      useTVPlayerStore.getState().setEngine(engine);
      useOverlayStore.getState().applySpeed(99);
      expect(useOverlayStore.getState().speed).toBe(2);
      expect(engine.setRate).toHaveBeenCalledWith(2);
    });

    it('closes the overlay after applying', () => {
      useOverlayStore.getState().open('speed');
      useOverlayStore.getState().applySpeed(1);
      expect(useOverlayStore.getState().active).toBeNull();
    });
  });

  describe('applySleep', () => {
    it('schedules a timer for a positive minute value', () => {
      useOverlayStore.getState().applySleep(30);
      expect(useTVPlayerStore.getState().sleep.kind).toBe('timer');
    });

    it('sets end-of-surah for a negative value', () => {
      useOverlayStore.getState().applySleep(-1);
      expect(useTVPlayerStore.getState().sleep.kind).toBe('endOfSurah');
    });

    it('clears the timer for zero minutes', () => {
      useOverlayStore.getState().applySleep(30);
      useOverlayStore.getState().applySleep(0);
      expect(useTVPlayerStore.getState().sleep.kind).toBe('off');
    });

    it('closes the overlay after applying', () => {
      useOverlayStore.getState().open('sleep');
      useOverlayStore.getState().applySleep(15);
      expect(useOverlayStore.getState().active).toBeNull();
    });
  });

  describe('applyPersistedSpeed', () => {
    it('re-applies the persisted speed to the engine on demand', () => {
      useOverlayStore.getState().applySpeed(1.5);
      const engine = makeMockEngine();
      useTVPlayerStore.getState().setEngine(engine);
      useOverlayStore.getState().applyPersistedSpeed();
      expect(engine.setRate).toHaveBeenCalledWith(1.5);
    });
  });

  describe('reset', () => {
    it('clears active overlay and restores default speed', () => {
      useOverlayStore.getState().open('speed');
      useOverlayStore.getState().applySpeed(2);
      useOverlayStore.getState().reset();
      expect(useOverlayStore.getState().active).toBeNull();
      expect(useOverlayStore.getState().speed).toBe(1);
    });
  });
});
