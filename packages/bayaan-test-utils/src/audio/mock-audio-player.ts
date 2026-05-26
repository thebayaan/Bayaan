/**
 * MockAudioPlayer — drop-in stand-in for expo-audio's AudioPlayer in jest tests.
 *
 * expo-audio's real AudioPlayer is bridged to native code and not directly
 * testable in jest. This double exposes the same surface (play / pause /
 * seekTo / replace / setRate / setVolume / addListener) plus deterministic
 * `simulate*` drivers so tests can step through the playback state machine.
 *
 * Lives in @bayaan/test-utils so RFC-005's `@bayaan/audio` services tests
 * can share it without re-importing from app code. The adapter test in
 * @bayaan/audio uses it today; once the audio services move into the
 * package (RFC-005 PR 6), every service test reuses this same fixture.
 */

export type StatusListener = (status: PlaybackStatus) => void;

export interface PlaybackStatus {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number | null;
  didJustFinish: boolean;
  rate: number;
  volume: number;
}

const EMPTY_STATUS: PlaybackStatus = {
  isLoaded: false,
  isPlaying: false,
  positionMillis: 0,
  durationMillis: null,
  didJustFinish: false,
  rate: 1,
  volume: 1,
};

/**
 * Usage:
 *   const player = new MockAudioPlayer();
 *   service.setPlayer(player);
 *   player.simulateLoaded({durationMillis: 30_000});
 *   player.simulatePlaybackProgress(5_000);
 *   player.simulateEnded();
 */
export class MockAudioPlayer {
  private status: PlaybackStatus = {...EMPTY_STATUS};
  private listeners: Set<StatusListener> = new Set();

  // ----- Surface mirroring expo-audio's AudioPlayer -----

  play = jest.fn(() => {
    this.status = {...this.status, isPlaying: true};
    this.emit();
  });

  pause = jest.fn(() => {
    this.status = {...this.status, isPlaying: false};
    this.emit();
  });

  seekTo = jest.fn((positionMillis: number) => {
    this.status = {...this.status, positionMillis};
    this.emit();
  });

  replace = jest.fn(async (_source: {uri: string}) => {
    this.status = {...EMPTY_STATUS};
    this.emit();
  });

  setRate = jest.fn((rate: number) => {
    this.status = {...this.status, rate};
    this.emit();
  });

  setVolume = jest.fn((volume: number) => {
    this.status = {...this.status, volume};
    this.emit();
  });

  addListener = jest.fn(
    (_event: 'playbackStatusUpdate', listener: StatusListener) => {
      this.listeners.add(listener);
      return {remove: () => this.listeners.delete(listener)};
    },
  );

  // ----- Test-only drivers -----

  simulateLoaded(opts: {durationMillis: number}) {
    this.status = {
      ...this.status,
      isLoaded: true,
      durationMillis: opts.durationMillis,
    };
    this.emit();
  }

  simulatePlaybackProgress(positionMillis: number) {
    this.status = {...this.status, positionMillis};
    this.emit();
  }

  simulateEnded() {
    this.status = {
      ...this.status,
      isPlaying: false,
      didJustFinish: true,
      positionMillis: this.status.durationMillis ?? 0,
    };
    this.emit();
  }

  simulateError() {
    this.status = {...this.status, isLoaded: false, isPlaying: false};
    this.emit();
  }

  /** Exposed for assertions in tests. */
  getStatus(): PlaybackStatus {
    return {...this.status};
  }

  private emit() {
    for (const l of this.listeners) l(this.status);
  }
}
