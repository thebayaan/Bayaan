import type {ContinueEntry} from './continueListeningStore';

type Progress = Pick<ContinueEntry, 'positionSeconds' | 'durationSeconds'>;

/** "8 min left", "1 h 12 min left", "Almost done", or "Started" without a length. */
export function timeLeftLabel(entry: Progress): string {
  if (!entry.durationSeconds) return 'Started';
  const left = Math.max(0, entry.durationSeconds - entry.positionSeconds);
  const minutes = Math.round(left / 60);
  if (minutes < 1) return 'Almost done';
  if (minutes < 60) return `${minutes} min left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h left` : `${h} h ${m} min left`;
}

/** How far through the surah, 0 to 1. */
export function progressOf(entry: Progress): number {
  return entry.durationSeconds
    ? Math.max(0, Math.min(1, entry.positionSeconds / entry.durationSeconds))
    : 0;
}
