// modules/bayaan-widgets/src/liveActivity.ts
// Content state of the Now Playing Live Activity. Field names match
// NowPlayingActivityState.swift (identical copies in modules/bayaan-widgets/ios
// and targets/widgets/LiveActivity); both decode __fixtures__/liveActivity.states.json.
import {isNullableString, isRecord} from './guards';

export interface NowPlayingAyah {
  number: number;
  count: number;
  text: string; // Digital Khatt, already truncated by the app
}

export interface NowPlayingActivityState {
  surahId: number; // 0 for user uploads without a surah
  surahName: string;
  reciterName: string;
  artworkFile: string | null; // file name inside the shared artwork dir
  isPlaying: boolean;
  positionSec: number; // at anchorAt
  durationSec: number;
  rate: number; // playback speed, 1 is normal
  anchorAt: number; // epoch ms when positionSec was sampled
  ayah: NowPlayingAyah | null;
}

export type ActivityStartResult =
  | 'started'
  | 'updated'
  | 'deferred'
  | 'disabled'
  | 'unsupported'
  | 'invalid'
  | 'error'
  | 'unavailable';

const START_RESULTS: readonly ActivityStartResult[] = [
  'started',
  'updated',
  'deferred',
  'disabled',
  'unsupported',
  'invalid',
  'error',
  'unavailable',
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isActivityStartResult(
  value: unknown,
): value is ActivityStartResult {
  return typeof value === 'string' && START_RESULTS.some(r => r === value);
}

export function isNowPlayingAyah(value: unknown): value is NowPlayingAyah {
  return (
    isRecord(value) &&
    isFiniteNumber(value.number) &&
    isFiniteNumber(value.count) &&
    typeof value.text === 'string'
  );
}

export function isNowPlayingActivityState(
  value: unknown,
): value is NowPlayingActivityState {
  return (
    isRecord(value) &&
    isFiniteNumber(value.surahId) &&
    typeof value.surahName === 'string' &&
    typeof value.reciterName === 'string' &&
    isNullableString(value.artworkFile) &&
    typeof value.isPlaying === 'boolean' &&
    isFiniteNumber(value.positionSec) &&
    isFiniteNumber(value.durationSec) &&
    isFiniteNumber(value.rate) &&
    isFiniteNumber(value.anchorAt) &&
    (value.ayah === null || isNowPlayingAyah(value.ayah))
  );
}

export function safeActivityRate(rate: number): number {
  return rate > 0 && Number.isFinite(rate) ? rate : 1;
}

function clampedPosition(s: NowPlayingActivityState): number {
  return Math.min(Math.max(s.positionSec, 0), Math.max(s.durationSec, 0));
}

/** Epoch ms at which the track would have been at 0, playing at its rate. */
export function activityWallStart(s: NowPlayingActivityState): number {
  return s.anchorAt - (clampedPosition(s) / safeActivityRate(s.rate)) * 1000;
}

/** Epoch ms at which the track ends if playback continues. */
export function activityWallEnd(s: NowPlayingActivityState): number {
  return (
    s.anchorAt +
    ((Math.max(s.durationSec, 0) - clampedPosition(s)) /
      safeActivityRate(s.rate)) *
      1000
  );
}
