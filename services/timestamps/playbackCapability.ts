// @ai-generated
/**
 * Whether the mushaf can play a selection with a reciter. The mushaf only plays
 * what it can follow along with, so this answers before the Play tap, from the
 * catalog and whatever is already known about each surah's verse numbering.
 */
import type {TimestampLoadFailure} from '@/types/timestamps';

export type PlaybackCapability =
  | {kind: 'ok'}
  /** The catalog has not loaded, so nothing is known about the reciter yet. */
  | {kind: 'catalog-loading'}
  /** The saved reciter is no longer in the catalog. */
  | {kind: 'reciter-removed'}
  /** The reciter has no verse timing at all. */
  | {kind: 'reciter-untimed'}
  /** The first surah of the selection that this reciter has no timing for. */
  | {kind: 'surah-not-covered'; surah: number}
  /** Timing exists, but its verses can't be matched to the mushaf's. */
  | {kind: 'numbering-mismatch'; surah: number}
  /** Timing should exist, but could not be loaded. Can be tried again. */
  | {kind: 'timing-failed'; surah: number; reason: TimestampLoadFailure};

/** What is known so far about a covered surah's timing, from loading it. */
export type SurahTimingCheck =
  | {status: 'ok'}
  | {status: 'unknown'}
  | {status: 'not-covered'}
  | {status: 'numbering-mismatch'}
  | {status: 'failed'; reason: TimestampLoadFailure};

export interface PlaybackCapabilityDeps {
  catalogLoaded: () => boolean;
  isListed: (rewayatId: string) => boolean;
  hasSource: (rewayatId: string) => boolean;
  hasSurah: (rewayatId: string, surah: number) => boolean;
  /** Absent or 'unknown' when the surah has not been checked yet. */
  surahCheck?: (rewayatId: string, surah: number) => SurahTimingCheck;
}

/**
 * The surahs from `first` through `last`, in reading order. Empty when either
 * is not a surah number.
 */
export function surahsBetween(first: number, last: number): number[] {
  if (first < 1 || last > 114 || first > last) return [];
  return Array.from({length: last - first + 1}, (_, i) => first + i);
}

/**
 * The verdict for playing `surahs` with a reciter. Problems in the catalog come
 * first since they need no loading; then the first surah, in reading order,
 * that a check found a problem with.
 */
export function playbackCapability(
  rewayatId: string,
  surahs: readonly number[],
  deps: PlaybackCapabilityDeps,
): PlaybackCapability {
  if (!deps.catalogLoaded()) return {kind: 'catalog-loading'};
  if (!deps.hasSource(rewayatId)) {
    return deps.isListed(rewayatId)
      ? {kind: 'reciter-untimed'}
      : {kind: 'reciter-removed'};
  }
  const uncovered = surahs.find(surah => !deps.hasSurah(rewayatId, surah));
  if (uncovered !== undefined) {
    return {kind: 'surah-not-covered', surah: uncovered};
  }
  for (const surah of surahs) {
    const check = deps.surahCheck?.(rewayatId, surah);
    switch (check?.status) {
      case 'not-covered':
        return {kind: 'surah-not-covered', surah};
      case 'numbering-mismatch':
        return {kind: 'numbering-mismatch', surah};
      case 'failed':
        return {kind: 'timing-failed', surah, reason: check.reason};
      default:
        break;
    }
  }
  return {kind: 'ok'};
}
