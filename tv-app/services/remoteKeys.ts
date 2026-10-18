/**
 * Normalizes TV remote events across tvOS, Android TV / Fire OS and Vega.
 *
 * The platforms disagree in two ways:
 * - Names: tvOS / react-native-tvos send `playPause` and `swipeLeft/Right`;
 *   Vega sends `playpause`, `skip_forward` / `skip_backward`, `forward` /
 *   `rewind`.
 * - Key phases: tvOS sends one event per press (no `eventKeyAction`),
 *   react-native-tvos on Android sends only the key-up (1), and Vega sends
 *   both key-down (0) and key-up (1).
 *
 * The filter acts on a key-down and swallows the matching key-up, and acts on
 * a key-up that had no key-down, so every platform yields one action per press.
 *
 * Play/Pause also passes through the transport gate (services/transportGate),
 * so on Vega a press the system already delivered as a media command is not
 * toggled a second time from the key event.
 */

import type {ScreenEntry} from '../store/navStore';
import {claimTransport} from './transportGate';

export type RemoteAction =
  | 'left'
  | 'right'
  | 'playPause'
  | 'seekForward'
  | 'seekBackward';

export type RemoteKeyEvent = {eventType: string; eventKeyAction?: number};

const KEY_DOWN = 0;
const KEY_UP = 1;

const ACTIONS: Readonly<Record<string, RemoteAction>> = {
  left: 'left',
  right: 'right',
  playPause: 'playPause',
  playpause: 'playPause',
  swipeRight: 'seekForward',
  swipeLeft: 'seekBackward',
  skip_forward: 'seekForward',
  skip_backward: 'seekBackward',
  forward: 'seekForward',
  fastForward: 'seekForward',
  rewind: 'seekBackward',
};

/**
 * The remote's dedicated transport keys, never the D-pad or touch-surface
 * swipes (which also move focus): Android TV / Fire OS send `playPause`,
 * `next`, `previous`, `fastForward`, `rewind`; Vega sends `playpause`,
 * `skip_forward` / `skip_backward` and `forward` / `rewind`. The Siri Remote
 * only has Play/Pause.
 */
export type MediaKey =
  | 'playPause'
  | 'next'
  | 'previous'
  | 'fastForward'
  | 'rewind';

const MEDIA_KEYS: Readonly<Record<string, MediaKey>> = {
  playPause: 'playPause',
  playpause: 'playPause',
  next: 'next',
  previous: 'previous',
  fastForward: 'fastForward',
  forward: 'fastForward',
  skip_forward: 'fastForward',
  rewind: 'rewind',
  skip_backward: 'rewind',
};

function createPhaseFilter<T extends string>(
  map: Readonly<Record<string, T>>,
  playPause: T,
): (event: RemoteKeyEvent) => T | null {
  const pendingDown = new Set<string>();
  const gated = (action: T): T | null =>
    action === playPause && !claimTransport('key') ? null : action;
  return function filter(event: RemoteKeyEvent): T | null {
    const action = map[event.eventType];
    if (!action) return null;
    if (event.eventKeyAction === KEY_DOWN) {
      pendingDown.add(event.eventType);
      return gated(action);
    }
    if (event.eventKeyAction === KEY_UP) {
      if (pendingDown.delete(event.eventType)) return null;
      return gated(action);
    }
    return gated(action);
  };
}

export function createRemoteKeyFilter(): (
  event: RemoteKeyEvent,
) => RemoteAction | null {
  return createPhaseFilter(ACTIONS, 'playPause');
}

/** Like createRemoteKeyFilter, for the transport keys only (see MediaKey). */
export function createMediaKeyFilter(): (
  event: RemoteKeyEvent,
) => MediaKey | null {
  return createPhaseFilter(MEDIA_KEYS, 'playPause');
}

/**
 * Transport keys a screen handles itself, so the app-wide handler
 * (hooks/useGlobalRemoteKeys) leaves them alone and no key acts twice. The
 * listening room toggles and steps through the recitation (fast-forward and
 * rewind move by verse there); Next / Previous still change surah through
 * the app-wide handler. The adhkar reader plays its own audio, so every
 * transport key belongs to it.
 */
export function screenOwnsMediaKey(
  top: ScreenEntry | undefined,
  key: MediaKey,
): boolean {
  if (top?.screen === 'adhkarReader') return true;
  if (top?.screen === 'nowPlaying') {
    return key === 'playPause' || key === 'fastForward' || key === 'rewind';
  }
  return false;
}

/** Whether the screen on top handles the remote's Play/Pause itself. */
export function screenOwnsPlayPause(top: ScreenEntry | undefined): boolean {
  return screenOwnsMediaKey(top, 'playPause');
}

/** How far the app-wide Fast-forward / Rewind keys move, in seconds. */
export const MEDIA_SEEK_SECONDS = 10;
