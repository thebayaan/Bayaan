/**
 * What the sidebar's now-playing tile (and the pill on stacked screens) says
 * and does. The tile is the one way back to the player from anywhere, so it
 * always names its state in words, not only with a glyph, and says what OK
 * will do when that is not simply "open the player".
 *
 * Before anything has played since launch, the newest Continue listening
 * entry stands in, so the way back to a recitation survives a relaunch.
 */
import type {PlayerStatus} from '../types/player';
import type {ContinueEntry} from './continueListeningStore';

export type TileState =
  | 'playing'
  | 'paused'
  | 'loading'
  | 'error'
  | 'finished'
  | 'resume';

/** What OK on the tile does. */
export type TileAction = 'open' | 'replay' | 'resume';

export type NowPlayingTile = {
  state: TileState;
  action: TileAction;
  /** The state in a word or two: "Now playing", "Paused", "Couldn't play". */
  label: string;
  /** The surah. */
  title: string;
  /** Second line: the state, then the reciter or what OK will do. */
  detail: string;
  /** How far through, 0..1, when known. */
  progress: number | null;
  accessibilityLabel: string;
};

export type TileInput = {
  item: {title: string; subtitle: string} | null;
  status: PlayerStatus;
  finished: boolean;
  positionSeconds: number;
  durationSeconds: number;
  /** The newest Continue listening entry, named, for when nothing is queued. */
  resume: {title: string; subtitle: string; entry: ContinueEntry} | null;
};

function fraction(position: number, duration: number): number | null {
  if (!(duration > 0)) return null;
  return Math.max(0, Math.min(1, position / duration));
}

function stateOf(status: PlayerStatus, finished: boolean): TileState {
  if (status === 'error') return 'error';
  if (finished) return 'finished';
  if (status === 'playing') return 'playing';
  if (status === 'loading' || status === 'buffering') return 'loading';
  return 'paused';
}

const LABELS: Record<TileState, string> = {
  playing: 'Now playing',
  paused: 'Paused',
  loading: 'Loading',
  error: "Couldn't play",
  finished: 'Finished',
  resume: 'Continue',
};

export function nowPlayingTile(input: TileInput): NowPlayingTile | null {
  const {item, resume} = input;
  if (!item) {
    if (!resume) return null;
    const {entry} = resume;
    const label = LABELS.resume;
    return {
      state: 'resume',
      action: 'resume',
      label,
      title: resume.title,
      detail: resume.subtitle ? `${label} · ${resume.subtitle}` : label,
      progress: fraction(entry.positionSeconds, entry.durationSeconds),
      accessibilityLabel: `${label} ${resume.title}${
        resume.subtitle ? ` with ${resume.subtitle}` : ''
      }.`,
    };
  }

  const state = stateOf(input.status, input.finished);
  const label = LABELS[state];
  const detail =
    state === 'error'
      ? `${label} · Open to retry`
      : state === 'finished'
        ? `${label} · Play again`
        : item.subtitle
          ? `${label} · ${item.subtitle}`
          : label;
  const action: TileAction = state === 'finished' ? 'replay' : 'open';
  return {
    state,
    action,
    label,
    title: item.title,
    detail,
    progress:
      state === 'finished'
        ? 1
        : fraction(input.positionSeconds, input.durationSeconds),
    accessibilityLabel: `${label}: ${item.title}. ${
      action === 'replay' ? 'Play again' : 'Open player'
    }.`,
  };
}
