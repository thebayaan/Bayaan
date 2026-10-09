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
  const pendingDown = new Set<string>();
  return function filter(event: RemoteKeyEvent): RemoteAction | null {
    const action = ACTIONS[event.eventType];
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
