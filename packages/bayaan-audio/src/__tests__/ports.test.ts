/**
 * Port shape and no-op default tests.
 *
 * These tests assert the seam itself — that the ports compile, that the
 * NullPlayerEventSink no-op implements the full surface, and that the
 * stub adapter satisfies the PlayerController contract.
 *
 * Behavior tests for real implementations live in their owning packages
 * (consumer-side: Bayaan's playerStore-backed controller in app code).
 */

import type {BaseTrack, PlaybackState} from '@bayaan/types';

import type {
  CoordinatorHooks,
  LockScreenMetadataSource,
  PlayerController,
  PlayerEventSink,
  TimestampProvider,
} from '../ports';
import {NullPlayerEventSink} from '../ports';
import {ExpoAudioPlayerControllerAdapter} from '../adapters/expo-audio-player-controller';

const sampleTrack: BaseTrack = {
  id: 'track-1',
  url: 'https://example.invalid/audio.mp3',
  title: 'Sample',
  artist: 'Artist',
  durationMs: 60_000,
};

describe('NullPlayerEventSink', () => {
  it('implements every PlayerEventSink method as a no-op', () => {
    expect(() => NullPlayerEventSink.onPlaybackStarted(sampleTrack)).not.toThrow();
    expect(() => NullPlayerEventSink.onPlaybackCompleted(sampleTrack, 30_000)).not.toThrow();
    expect(() => NullPlayerEventSink.onPlaybackPaused(sampleTrack, 15_000)).not.toThrow();
    expect(() => NullPlayerEventSink.onSkip(sampleTrack, 'forward')).not.toThrow();
    expect(() => NullPlayerEventSink.onSkip(sampleTrack, 'backward')).not.toThrow();
    expect(() => NullPlayerEventSink.onRateChange(1, 1.5)).not.toThrow();
    expect(() => NullPlayerEventSink.onSeek(sampleTrack, 1000, 5000)).not.toThrow();
    expect(() => NullPlayerEventSink.onError(new Error('x'), {})).not.toThrow();
  });
});

describe('ExpoAudioPlayerControllerAdapter — PlayerController contract', () => {
  let controller: PlayerController<BaseTrack>;

  beforeEach(() => {
    controller = new ExpoAudioPlayerControllerAdapter<BaseTrack>();
  });

  it('exposes every required method', () => {
    expect(typeof controller.onPlaybackStateChange).toBe('function');
    expect(typeof controller.onProgressUpdate).toBe('function');
    expect(typeof controller.onTrackChanged).toBe('function');
    expect(typeof controller.onTrackEnded).toBe('function');
    expect(typeof controller.onError).toBe('function');
    expect(typeof controller.onProgressPersist).toBe('function');
  });

  const states: PlaybackState[] = [
    'idle',
    'loading',
    'ready',
    'playing',
    'paused',
    'error',
  ];

  it.each(states)('accepts state %s without throwing', (state) => {
    expect(() => controller.onPlaybackStateChange(state)).not.toThrow();
  });

  it('accepts progress updates across the duration range and edge cases', () => {
    expect(() => controller.onProgressUpdate(0, 60_000)).not.toThrow();
    expect(() => controller.onProgressUpdate(30_000, 60_000)).not.toThrow();
    expect(() => controller.onProgressUpdate(60_000, 60_000)).not.toThrow();
    expect(() => controller.onProgressUpdate(-100, 60_000)).not.toThrow();
    expect(() => controller.onProgressUpdate(70_000, 60_000)).not.toThrow();
    expect(() => controller.onProgressUpdate(0, 0)).not.toThrow();
  });

  it('accepts track-changed with track and with null', () => {
    expect(() => controller.onTrackChanged(sampleTrack)).not.toThrow();
    expect(() => controller.onTrackChanged(null)).not.toThrow();
  });

  it('accepts track-ended', () => {
    expect(() => controller.onTrackEnded(sampleTrack)).not.toThrow();
  });

  it('accepts error with and without context', () => {
    expect(() => controller.onError(new Error('boom'), {source: 'test'})).not.toThrow();
    expect(() => controller.onError(new Error('boom'), {})).not.toThrow();
  });

  it('accepts progress persist at boundaries', () => {
    expect(() => controller.onProgressPersist(sampleTrack, 0, 60_000)).not.toThrow();
    expect(() => controller.onProgressPersist(sampleTrack, 60_000, 60_000)).not.toThrow();
  });

  it('survives the realistic call ordering during playback', () => {
    expect(() => {
      controller.onTrackChanged(sampleTrack);
      controller.onPlaybackStateChange('loading');
      controller.onPlaybackStateChange('ready');
      controller.onPlaybackStateChange('playing');
      for (let i = 0; i < 10; i++) {
        controller.onProgressUpdate(i * 1000, 60_000);
      }
      controller.onProgressPersist(sampleTrack, 10_000, 60_000);
      controller.onProgressUpdate(60_000, 60_000);
      controller.onTrackEnded(sampleTrack);
      controller.onPlaybackStateChange('paused');
      controller.onTrackChanged(null);
    }).not.toThrow();
  });
});

describe('Type-shape compile checks', () => {
  // These exist purely to assert that the public types are referenceable.
  // If an interface drifts, this file fails to compile — which is the test.
  it('CoordinatorHooks shape', () => {
    const hooks: CoordinatorHooks = {
      pauseMain: () => {},
      pauseMushaf: () => {},
      getMainIsPlaying: () => false,
      getMushafIsPlaying: () => false,
    };
    expect(hooks.getMainIsPlaying()).toBe(false);
  });

  it('TimestampProvider shape', async () => {
    const provider: TimestampProvider = {
      fetchTimestamps: async () => [],
    };
    await expect(provider.fetchTimestamps('any-key')).resolves.toEqual([]);
  });

  it('LockScreenMetadataSource shape', () => {
    const source: LockScreenMetadataSource = {
      subscribeMain: () => () => {},
      subscribeMushaf: () => () => {},
    };
    const unsubscribe = source.subscribeMain(() => {});
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('PlayerEventSink shape can be implemented generically', () => {
    type ConsumerTrack = BaseTrack & {meta: {surahId: number}};
    const sink: PlayerEventSink<ConsumerTrack> = {
      onPlaybackStarted: (t) => expect(t.meta.surahId).toBeGreaterThan(0),
      onPlaybackCompleted: () => {},
      onPlaybackPaused: () => {},
      onSkip: () => {},
      onRateChange: () => {},
      onSeek: () => {},
      onError: () => {},
    };
    sink.onPlaybackStarted({...sampleTrack, meta: {surahId: 1}});
  });
});
