// @ai-start
import type {AyahTimestamp} from '@/types/timestamps';
import type {MomentPassage} from './passages';

export interface MomentAyah {
  ayah: number;
  startMs: number;
  endMs: number;
}

export interface MomentClip {
  startMs: number;
  endMs: number;
  ayat: MomentAyah[];
}

export interface ClipLimits {
  minMs: number;
  maxMs: number;
}

export const DEFAULT_CLIP_LIMITS: ClipLimits = {minMs: 8_000, maxMs: 90_000};

/**
 * Cuts a passage out of a reciter's surah timestamps.
 *
 * Returns null when any ayah in the range is missing or the clip falls outside
 * the length limits, so a reciter whose timing is off never gets a half-ayah
 * or a ten-minute moment.
 */
export function buildMoment(
  passage: MomentPassage,
  timestamps: AyahTimestamp[],
  limits: ClipLimits = DEFAULT_CLIP_LIMITS,
): MomentClip | null {
  const byAyah = new Map<number, AyahTimestamp>();
  for (const t of timestamps) {
    if (t.surahNumber === passage.surah) byAyah.set(t.ayahNumber, t);
  }

  const ayat: MomentAyah[] = [];
  for (let ayah = passage.fromAyah; ayah <= passage.toAyah; ayah++) {
    const t = byAyah.get(ayah);
    if (!t || t.timestampTo <= t.timestampFrom) return null;
    const prev = ayat[ayat.length - 1];
    if (prev && t.timestampFrom < prev.startMs) return null;
    ayat.push({ayah, startMs: t.timestampFrom, endMs: t.timestampTo});
  }

  const startMs = ayat[0].startMs;
  const endMs = ayat[ayat.length - 1].endMs;
  const length = endMs - startMs;
  if (length < limits.minMs || length > limits.maxMs) return null;

  return {startMs, endMs, ayat};
}

/** The ayah playing at a position in the surah file, or the last one passed. */
export function ayahAt(clip: MomentClip, positionMs: number): number {
  let current = clip.ayat[0].ayah;
  for (const a of clip.ayat) {
    if (positionMs >= a.startMs) current = a.ayah;
    else break;
  }
  return current;
}

/**
 * Where Continue should pick up in the surah file. Mid-moment it restarts the
 * ayah that is playing, so tapping Continue never skips the rest of an ayah.
 * Once the moment has played to the end, it starts with the next ayah.
 */
export function continueFromMs(
  clip: MomentClip,
  positionMs: number | null,
): number {
  if (positionMs === null || positionMs >= clip.endMs) return clip.endMs;
  const ayah = ayahAt(clip, positionMs);
  return clip.ayat.find(a => a.ayah === ayah)?.startMs ?? clip.endMs;
}
// @ai-end
