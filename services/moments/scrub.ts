// @ai-start
/**
 * Pure helpers for the Moments scrubber. Positions are surah-file positions in
 * milliseconds, like everywhere else in Moments; a clip covers
 * [clip.startMs, clip.endMs]. The worklet directives let the scrubber's
 * gestures call these on the UI thread.
 */

interface ClipRange {
  startMs: number;
  endMs: number;
}

/** Clamps a position to the clip, so a seek never leaves the moment. */
export function clampToClip(positionMs: number, clip: ClipRange): number {
  'worklet';
  if (!Number.isFinite(positionMs)) return clip.startMs;
  return Math.min(clip.endMs, Math.max(clip.startMs, positionMs));
}

/** How far through the clip a position is, from 0 to 1. */
export function clipProgress(positionMs: number, clip: ClipRange): number {
  'worklet';
  const length = clip.endMs - clip.startMs;
  if (length <= 0) return 0;
  return (clampToClip(positionMs, clip) - clip.startMs) / length;
}

/** The clip position for a 0 to 1 ratio along the bar, clamped. */
export function ratioToClipMs(ratio: number, clip: ClipRange): number {
  'worklet';
  const r = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return clampToClip(clip.startMs + r * (clip.endMs - clip.startMs), clip);
}

/** The 0 to 1 ratio for a touch at `x` on a bar `width` wide, clamped. */
export function xToRatio(x: number, width: number): number {
  'worklet';
  if (!(width > 0) || !Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x / width));
}

/** The clip position for a touch at `x` on a bar `width` wide, clamped. */
export function xToClipMs(x: number, width: number, clip: ClipRange): number {
  'worklet';
  return ratioToClipMs(xToRatio(x, width), clip);
}

/** Formats a duration as m:ss (or h:mm:ss), rounding down to the second. */
export function formatClipTime(ms: number): string {
  'worklet';
  const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = seconds < 10 ? `0${seconds}` : `${seconds}`;
  if (hours > 0) {
    const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/**
 * Whether a position update can follow a seek to `targetMs` made `elapsedMs`
 * ago. The audio service reports the target as soon as it seeks, but the
 * player can still send a few updates from the old spot until the seek lands.
 * Those would make the bar jump back, so only positions between the target
 * and how far playback could have moved since (at up to `maxRate`) count.
 */
export function followsSeek(
  positionMs: number,
  targetMs: number,
  elapsedMs: number,
  toleranceMs = 600,
  maxRate = 2,
): boolean {
  const ahead = Math.max(0, elapsedMs) * maxRate + toleranceMs;
  return positionMs >= targetMs - toleranceMs && positionMs <= targetMs + ahead;
}
// @ai-end
