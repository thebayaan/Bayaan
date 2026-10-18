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
import {shortReciterName} from './listeningChoices';

export type TileState =
  | 'playing'
  | 'paused'
  | 'loading'
  | 'error'
  | 'finished'
  | 'resume';

/**
 * What OK on the tile does: open the player; resume a paused or failed
 * track and open it (the same as Home's Now playing strip); play a finished
 * queue again; or resume the newest Continue entry after a relaunch.
 */
export type TileAction = 'open' | 'toggle' | 'replay' | 'resume';

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

/**
 * The newest entry that can be resumed: its reciter is still in the catalog
 * (Home's Continue rail hides the others), so the tile and the first
 * Continue card always agree.
 */
export function newestResumable(
  entries: readonly ContinueEntry[],
  isKnownReciter: (id: string) => boolean,
): ContinueEntry | null {
  return entries.find(e => isKnownReciter(e.reciterId)) ?? null;
}

// The second line is narrow: "Al-Minshawi", not "Mohammed Siddiq Al-…".
function detailLine(label: string, reciter: string): string {
  return reciter ? `${label} · ${shortReciterName(reciter)}` : label;
}

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
      detail: detailLine(label, resume.subtitle),
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
      ? `${label} · Try again`
      : state === 'finished'
        ? `${label} · Play again`
        : detailLine(label, item.subtitle);
  const action: TileAction =
    state === 'finished'
      ? 'replay'
      : state === 'paused' || state === 'error'
        ? 'toggle'
        : 'open';
  const does =
    action === 'replay'
      ? 'Play again'
      : state === 'error'
        ? 'Try again'
        : action === 'toggle'
          ? 'Resume'
          : 'Open player';
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
    accessibilityLabel: `${label}: ${item.title}${
      item.subtitle ? ` with ${item.subtitle}` : ''
    }. ${does}.`,
  };
}
