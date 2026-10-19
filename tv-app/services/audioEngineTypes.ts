/**
 * Platform-neutral audio engine contract. The player store depends only on
 * these types; `audioEngine.ts` (expo-audio) and `audioEngine.kepler.ts`
 * (Vega W3C media) both implement them.
 */

export type EngineStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'error';

export type EngineEvent = {
  status: EngineStatus;
  positionSeconds: number;
  durationSeconds: number;
  /**
   * Why playback failed, with status 'error', when the engine knows (a
   * native message for the logs; the store decides what the screen says).
   */
  error?: string;
};

export type AudioEngine = {
  load: (url: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  setRate: (rate: number) => void;
  /** 0 to 1; used to fade out at the end of a sleep timer. */
  setVolume: (volume: number) => void;
  subscribe: (cb: (e: EngineEvent) => void) => () => void;
  destroy: () => void;
};
