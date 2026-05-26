/**
 * ExpoAudioPlayerControllerAdapter — stub adapter for the PlayerController port.
 *
 * THIS IS A SCAFFOLD. RFC-004 ships only the seam (port interfaces) plus
 * this stub so the package compiles end-to-end and the shape is reviewable
 * in advance. The real wiring of expo-audio's `AudioPlayer` happens in
 * RFC-005's audio-services-refactor PRs (PRs 3–6 in ADR-0001's table).
 *
 * Why ship a stub now rather than waiting:
 *  - Demonstrates that the port is implementable as a class wrapping a
 *    consumer store (Bayaan's `playerStore`) — which is what ADR-0001
 *    promises for the migration.
 *  - Lets the package self-contain its tests (the contract suite and the
 *    `MockAudioPlayer`-driven test both reference this class).
 *  - Surfaces type-shape problems with the port at review time, not at
 *    integration time.
 *
 * Why no expo-audio coupling yet:
 *  - The package does not import from `expo-audio` until the move PR
 *    (ADR-0001 PR 6). Pre-extraction, the audio engine still lives in
 *    `services/audio/*`. Importing expo-audio here would invert the
 *    dependency direction the RFC sequence is establishing.
 */

import type {BaseTrack, PlaybackState} from '@bayaan/types';

import type {PlayerController} from '../ports';

/**
 * Reference implementation of `PlayerController<TTrack>` against the future
 * `BayaanAudioProvider`. Behavior is intentionally minimal — every callback
 * is a no-op the consumer overrides via subclass or composition. The full
 * implementation arrives with RFC-005.
 */
export class ExpoAudioPlayerControllerAdapter<TTrack extends BaseTrack = BaseTrack>
  implements PlayerController<TTrack>
{
  onPlaybackStateChange(_state: PlaybackState): void {
    // RFC-005: forward state to consumer store.
  }

  onProgressUpdate(_positionMs: number, _durationMs: number): void {
    // RFC-005: throttle and forward to consumer store.
  }

  onTrackChanged(_track: TTrack | null): void {
    // RFC-005: update consumer's current-track field.
  }

  onTrackEnded(_track: TTrack): void {
    // RFC-005: signal consumer; consumer decides repeat / advance / stop.
  }

  onError(_error: Error, _context: Record<string, unknown>): void {
    // RFC-005: surface to consumer + analytics sink.
  }

  onProgressPersist(
    _track: TTrack,
    _positionMs: number,
    _durationMs: number,
  ): void {
    // RFC-005: low-cadence persist hook.
  }
}
