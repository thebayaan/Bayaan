// modules/bayaan-widgets/src/widgetKinds.ts
import {WidgetSnapshot} from './snapshot';

export type WidgetKind =
  | 'ContinueListening'
  | 'QuickSurah'
  | 'PinnedReciter'
  | 'AyahOfTheDay'
  | 'ContinueReading'
  | 'Tasbeeh';

export const ALL_WIDGET_KINDS: readonly WidgetKind[] = [
  'ContinueListening',
  'QuickSurah',
  'PinnedReciter',
  'AyahOfTheDay',
  'ContinueReading',
  'Tasbeeh',
];

// Seconds the anchor may drift before a playing widget is reloaded.
export const SEEK_TOLERANCE_SEC = 2;

// Position is excluded while playing: widgets animate it from
// generatedAt + positionSec, so ticks must not trigger reloads.
function nowPlayingKey(s: WidgetSnapshot): unknown {
  const np = s.nowPlaying;
  if (!np) return null;
  return {
    track: np.track,
    isPlaying: np.isPlaying,
    durationSec: Math.round(np.durationSec),
    rate: np.rate,
    pausedAt: np.isPlaying ? null : Math.round(np.positionSec),
  };
}

function safeRate(rate: number): number {
  return rate > 0 && Number.isFinite(rate) ? rate : 1;
}

// Wall-clock time (seconds) at which the track would have been at 0.
// Constant during continuous playback; jumps on a seek.
function playbackAnchor(s: WidgetSnapshot): number | null {
  const np = s.nowPlaying;
  if (!np || !np.isPlaying) return null;
  return s.generatedAt / 1000 - np.positionSec / safeRate(np.rate);
}

// prev is the last written snapshot, so small drift accumulates against a
// fixed reference instead of resetting on every tick.
function seekedWhilePlaying(
  prev: WidgetSnapshot,
  next: WidgetSnapshot,
): boolean {
  const a = playbackAnchor(prev);
  const b = playbackAnchor(next);
  if (a === null || b === null) return false;
  if (
    JSON.stringify(prev.nowPlaying?.track) !==
    JSON.stringify(next.nowPlaying?.track)
  ) {
    return false;
  }
  return Math.abs(a - b) > SEEK_TOLERANCE_SEC;
}

function sliceFor(kind: WidgetKind, s: WidgetSnapshot): unknown {
  switch (kind) {
    case 'ContinueListening':
      return [nowPlayingKey(s), s.upNext, s.recent, s.defaultReciter];
    case 'QuickSurah':
      return s.defaultReciter;
    case 'PinnedReciter':
      return [s.reciterRecents, s.defaultReciter];
    case 'AyahOfTheDay':
      return null;
    case 'ContinueReading':
      return s.lastRead;
    case 'Tasbeeh':
      return s.tasbeeh;
  }
}

export function changedWidgetKinds(
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
): WidgetKind[] {
  if (!prev || prev.theme !== next.theme) return [...ALL_WIDGET_KINDS];
  return ALL_WIDGET_KINDS.filter(
    kind =>
      JSON.stringify(sliceFor(kind, prev)) !==
        JSON.stringify(sliceFor(kind, next)) ||
      (kind === 'ContinueListening' && seekedWhilePlaying(prev, next)),
  );
}
