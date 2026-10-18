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
 */

import type {ScreenEntry} from '../store/navStore';
import type {PlayerStatus} from '../types/player';

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

export function createRemoteKeyFilter(): (
  event: RemoteKeyEvent,
) => RemoteAction | null {
  return createKeyFilter(ACTIONS);
}

/**
 * Discrete media keys (HDMI-CEC remotes, Shield and other Android TV
 * remotes, keyboards): explicit Play and Pause, and next/previous track.
 * Kept apart from createRemoteKeyFilter so screens that switch on its
 * actions never see these.
 */
export type MediaKeyAction = 'play' | 'pause' | 'next' | 'previous';

const MEDIA_ACTIONS: Readonly<Record<string, MediaKeyAction>> = {
  play: 'play',
  pause: 'pause',
  next: 'next',
  previous: 'previous',
};

export function createMediaKeyFilter(): (
  event: RemoteKeyEvent,
) => MediaKeyAction | null {
  return createKeyFilter(MEDIA_ACTIONS);
}

function createKeyFilter<A extends string>(
  actions: Readonly<Record<string, A>>,
): (event: RemoteKeyEvent) => A | null {
  const pendingDown = new Set<string>();
  return function filter(event: RemoteKeyEvent): A | null {
    const action = actions[event.eventType];
    if (!action) return null;
    if (event.eventKeyAction === KEY_DOWN) {
      pendingDown.add(event.eventType);
      return action;
    }
    if (event.eventKeyAction === KEY_UP) {
      if (pendingDown.delete(event.eventType)) return null;
      return action;
    }
    return action;
  };
}

/**
 * Screens that handle the remote's Play/Pause themselves (the listening room
 * toggles the recitation, the adhkar reader its own audio). Everywhere else
 * the app-wide handler toggles the recitation, so the key never toggles twice.
 */
export function screenOwnsPlayPause(top: ScreenEntry | undefined): boolean {
  return top?.screen === 'nowPlaying' || top?.screen === 'adhkarReader';
}

export type MediaCommand = 'toggle' | 'next' | 'previous';

/**
 * What a discrete media key does to the recitation, app-wide (no screen
 * handles these itself): Play only starts, Pause only stops, and both leave
 * a loading track alone. The adhkar reader keeps them away from the Quran
 * player, as it does Play/Pause, since its own audio is the one on screen.
 */
export function mediaKeyCommand(
  action: MediaKeyAction,
  top: ScreenEntry | undefined,
  status: PlayerStatus,
): MediaCommand | null {
  if (top?.screen === 'adhkarReader') return null;
  switch (action) {
    case 'play':
      return status === 'paused' || status === 'idle' || status === 'error'
        ? 'toggle'
        : null;
    case 'pause':
      return status === 'playing' ? 'toggle' : null;
    case 'next':
      return 'next';
    case 'previous':
      return 'previous';
  }
}
