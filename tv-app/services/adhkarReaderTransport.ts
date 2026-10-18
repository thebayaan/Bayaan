// The adhkar reader's remote: its keys, and its transport for commands that
// reach the app outside its own key handling. On Vega the system's media
// controls (the remote's transport keys and Alexa) arrive as commands to the
// playing engine; while the reader is open it registers the same controls
// its keys use, so both paths go through the session store and turn its
// pages, rather than driving the recitation's audio element behind the
// store's back.
import type {MediaTransport} from './mediaTransport';
import {
  createMediaKeyFilter,
  createRemoteKeyFilter,
  type RemoteKeyEvent,
} from './remoteKeys';

/** What the reader's remote can do. */
export type ReaderControls = {
  toggle: () => void;
  /** Plays when nothing is playing; never pauses. */
  play: () => void;
  /** Pauses what is playing; never starts it. */
  pause: () => void;
  nextDhikr: () => void;
  previousDhikr: () => void;
  /** The next page of a long dhikr, else the next dhikr. */
  pageForward: () => void;
  /** The page before, else the previous dhikr at its end. */
  pageBack: () => void;
};

// The D-pad and the touch surface's swipes also move focus: they turn pages
// only while the stage has focus. The transport keys work wherever focus is.
const STAGE_KEYS = new Set(['left', 'right', 'swipeLeft', 'swipeRight']);

/**
 * The reader's key handler. Every transport key belongs to the reader while
 * it is open (services/remoteKeys screenOwnsMediaKey): Play/Pause and the
 * separate Play and Pause keys play the recitation, Next / Previous move
 * between adhkar, Fast-forward / Rewind turn pages like Right / Left.
 */
export function createReaderKeyHandler(
  controls: ReaderControls,
  stageFocused: () => boolean,
): (event: RemoteKeyEvent) => void {
  const arrows = createRemoteKeyFilter();
  const media = createMediaKeyFilter();
  return function handle(event: RemoteKeyEvent): void {
    if (STAGE_KEYS.has(event.eventType)) {
      const action = arrows(event);
      if (!action || !stageFocused()) return;
      if (action === 'right' || action === 'seekForward') {
        controls.pageForward();
      } else {
        controls.pageBack();
      }
      return;
    }
    switch (media(event)) {
      case 'playPause':
        controls.toggle();
        return;
      case 'play':
        controls.play();
        return;
      case 'pause':
        controls.pause();
        return;
      case 'next':
        controls.nextDhikr();
        return;
      case 'previous':
        controls.previousDhikr();
        return;
      case 'fastForward':
        controls.pageForward();
        return;
      case 'rewind':
        controls.pageBack();
        return;
      default:
        return;
    }
  };
}

/** The reader's controls as the system's media commands see them. */
export function readerTransport(controls: ReaderControls): MediaTransport {
  return {
    toggle: controls.toggle,
    play: controls.play,
    pause: controls.pause,
    next: controls.nextDhikr,
    previous: controls.previousDhikr,
    seekBy: seconds =>
      seconds < 0 ? controls.pageBack() : controls.pageForward(),
  };
}

let current: MediaTransport | null = null;

/** Registers the open reader's transport; the returned function removes it. */
export function setAdhkarReaderTransport(
  transport: MediaTransport,
): () => void {
  current = transport;
  return () => {
    if (current === transport) current = null;
  };
}

/** The open reader's transport, or null when no reader is open. */
export function adhkarReaderTransport(): MediaTransport | null {
  return current;
}
