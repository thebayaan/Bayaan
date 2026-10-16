// services/widgets/live-activity/planActivity.ts
// Pure Live Activity policy: snapshot -> content state, what to ask ActivityKit
// for given what was last sent, and how each native result changes memory.
import {
  SEEK_TOLERANCE_SEC,
  activityWallEnd,
  safeActivityRate,
  type ActivityStartResult,
  type NowPlayingActivityState,
  type NowPlayingAyah,
  type WidgetSnapshot,
} from 'bayaan-widgets';

// Seconds the playback anchor may drift before a playing activity is updated
// (a seek). Shared with changedWidgetKinds.
export {SEEK_TOLERANCE_SEC};
// A track this close to its end has finished (last track ended).
export const END_TOLERANCE_SEC = 1;
export const PAUSED_STALE_MS = 15 * 60 * 1000;
export const ENDED_GRACE_MS = 60 * 1000;

export interface ActivityMemory {
  live: boolean;
  // Last state sent to ActivityKit; drift is measured against it.
  last: NowPlayingActivityState | null;
  // Track whose activity was dismissed or failed to start; not started again
  // until the track changes.
  suppressedTrack: string | null;
}

export const INITIAL_ACTIVITY_MEMORY: ActivityMemory = {
  live: false,
  last: null,
  suppressedTrack: null,
};

export type ActivityPlan =
  | {kind: 'start'; state: NowPlayingActivityState; staleAt: number}
  | {kind: 'update'; state: NowPlayingActivityState; staleAt: number}
  | {kind: 'end'}
  | {kind: 'none'};

export function activityStateFromSnapshot(
  snapshot: WidgetSnapshot,
  ayah: NowPlayingAyah | null,
  nowMs: number,
): NowPlayingActivityState | null {
  const np = snapshot.nowPlaying;
  if (!np) return null;
  // The player can keep reporting isPlaying at the end of the queue, so a
  // playing track is extrapolated from its anchor before the end check.
  const elapsedSec = np.isPlaying
    ? Math.max(nowMs - snapshot.generatedAt, 0) / 1000
    : 0;
  const positionNow = np.positionSec + elapsedSec * safeActivityRate(np.rate);
  const finished =
    np.durationSec > 0 && positionNow >= np.durationSec - END_TOLERANCE_SEC;
  if (finished) return null;
  return {
    surahId: np.track.surahId,
    surahName: np.track.surahName,
    reciterName: np.track.reciterName,
    artworkFile: np.track.artworkFile,
    isPlaying: np.isPlaying,
    positionSec: np.positionSec,
    durationSec: np.durationSec,
    rate: np.rate,
    anchorAt: snapshot.generatedAt,
    ayah,
  };
}

export function activityTrackKey(s: NowPlayingActivityState): string {
  return JSON.stringify([s.surahId, s.surahName, s.reciterName]);
}

// Wall-clock seconds at which the track would have been at 0. Constant during
// continuous playback; jumps on a seek.
function anchorSec(s: NowPlayingActivityState): number {
  return s.anchorAt / 1000 - s.positionSec / safeActivityRate(s.rate);
}

// Everything the activity renders except the playing position, which the
// timer views animate on their own.
function visibleKey(s: NowPlayingActivityState): string {
  return JSON.stringify([
    s.surahId,
    s.surahName,
    s.reciterName,
    s.artworkFile,
    s.isPlaying,
    Math.round(s.durationSec),
    safeActivityRate(s.rate),
    s.ayah ? s.ayah.number : null,
    s.ayah ? s.ayah.text : null,
    s.isPlaying ? null : Math.round(s.positionSec),
  ]);
}

export function activityNeedsUpdate(
  prev: NowPlayingActivityState,
  next: NowPlayingActivityState,
): boolean {
  if (visibleKey(prev) !== visibleKey(next)) return true;
  return (
    next.isPlaying &&
    Math.abs(anchorSec(prev) - anchorSec(next)) > SEEK_TOLERANCE_SEC
  );
}

export function staleAtFor(s: NowPlayingActivityState, nowMs: number): number {
  return s.isPlaying
    ? activityWallEnd(s) + ENDED_GRACE_MS
    : nowMs + PAUSED_STALE_MS;
}

export function planActivity(
  memory: ActivityMemory,
  next: NowPlayingActivityState | null,
  nowMs: number,
): ActivityPlan {
  if (!next) return memory.live ? {kind: 'end'} : {kind: 'none'};
  if (!memory.live) {
    if (!next.isPlaying || activityTrackKey(next) === memory.suppressedTrack) {
      return {kind: 'none'};
    }
    return {kind: 'start', state: next, staleAt: staleAtFor(next, nowMs)};
  }
  if (memory.last && !activityNeedsUpdate(memory.last, next)) {
    return {kind: 'none'};
  }
  return {kind: 'update', state: next, staleAt: staleAtFor(next, nowMs)};
}

export function afterStart(
  memory: ActivityMemory,
  state: NowPlayingActivityState,
  result: ActivityStartResult,
): ActivityMemory {
  switch (result) {
    case 'started':
    case 'updated':
      return {live: true, last: state, suppressedTrack: null};
    case 'deferred':
      // The app was not active; syncLiveActivity retries on foreground.
      return {...memory, live: false, last: null};
    default:
      return {
        live: false,
        last: null,
        suppressedTrack: activityTrackKey(state),
      };
  }
}

export function afterUpdate(
  memory: ActivityMemory,
  state: NowPlayingActivityState,
  ok: boolean,
): ActivityMemory {
  if (ok) return {...memory, live: true, last: state};
  return {live: false, last: null, suppressedTrack: activityTrackKey(state)};
}

export function afterEnd(): ActivityMemory {
  return INITIAL_ACTIVITY_MEMORY;
}
