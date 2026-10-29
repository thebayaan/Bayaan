import type {PanGesture} from 'react-native-gesture-handler';
import {usePlayerStore} from './store/playerStore';

/**
 * Window rect of the mini player the full player opens from. The morphing
 * player surface grows out of this rect and shrinks back onto it on close.
 */
export interface PlayerRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export type PlayerOrigin = PlayerRect;

/**
 * Imperative handle the player container (the morphing PlayerSurface)
 * registers.
 */
export interface PlayerSheetController {
  expand: (origin?: PlayerOrigin) => void;
  close: () => void;
  /**
   * Swipe-up-to-open pan for the mini player, driving the open with the
   * finger.
   */
  createOpenGesture: () => PanGesture;
}

type AnchorMeasurer = (done: (origin?: PlayerOrigin) => void) => void;

/**
 * The mounted mini players (iOS bottom accessory, Android pill or tablet dock)
 * register how to measure themselves, so the morphing surface can open from
 * and close onto wherever the visible one currently sits, whoever triggered
 * the open. More than one can be mounted (a hidden pill renders nothing and
 * measures as undefined), so the newest one that measures wins.
 */
const _anchors: AnchorMeasurer[] = [];

export function registerMiniPlayerAnchor(measure: AnchorMeasurer) {
  unregisterMiniPlayerAnchor(measure);
  _anchors.push(measure);
}

export function unregisterMiniPlayerAnchor(measure: AnchorMeasurer) {
  const index = _anchors.indexOf(measure);
  if (index !== -1) _anchors.splice(index, 1);
}

/**
 * A view that is mounted in React but not attached natively (e.g. inside a
 * tab accessory the OS doesn't show) never answers measureInWindow, so each
 * candidate gets this long before the next one is tried.
 */
const ANCHOR_MEASURE_TIMEOUT_MS = 100;

/**
 * Measures the visible mini player; `done()` gets undefined if none. Always
 * calls `done()` exactly once.
 */
export function measureMiniPlayerAnchor(done: (origin?: PlayerOrigin) => void) {
  const candidates = [..._anchors].reverse();
  const tryNext = (i: number) => {
    if (i >= candidates.length) {
      done(undefined);
      return;
    }
    let answered = false;
    const next = (origin?: PlayerOrigin) => {
      if (answered) return;
      answered = true;
      clearTimeout(timer);
      if (origin) done(origin);
      else tryNext(i + 1);
    };
    const timer = setTimeout(() => next(undefined), ANCHOR_MEASURE_TIMEOUT_MS);
    candidates[i](next);
  };
  tryNext(0);
}

/**
 * Module-scope holder for the active player container, so the mini players
 * and deep links can open and close it imperatively.
 */
let _controller: PlayerSheetController | null = null;
const _controllerListeners = new Set<() => void>();

function notifyControllerChange() {
  _controllerListeners.forEach(listener => listener());
}

/** For useSyncExternalStore: re-render when the active container changes. */
export function subscribePlayerSheetController(listener: () => void) {
  _controllerListeners.add(listener);
  return () => {
    _controllerListeners.delete(listener);
  };
}

export function getPlayerSheetController() {
  return _controller;
}

export function registerPlayerSheetController(
  controller: PlayerSheetController,
) {
  _controller = controller;
  notifyControllerChange();
}

export function unregisterPlayerSheetController(
  controller: PlayerSheetController,
) {
  if (_controller === controller) {
    _controller = null;
    notifyControllerChange();
  }
}

/**
 * Expand the player. Always calls the imperative expand() AND sets sheetMode
 * to 'full', so even if sheetMode was stale (stuck on 'full' from a missed
 * onChange), the player still opens. `origin` is the tapped mini player's
 * window rect; without it the player measures the mounted mini player.
 */
export function expandPlayerSheet(origin?: PlayerOrigin) {
  usePlayerStore.getState().setSheetMode('full');
  _controller?.expand(origin);
}

/**
 * Close the player sheet imperatively and sync store state.
 */
export function closePlayerSheet() {
  usePlayerStore.getState().setSheetMode('hidden');
  _controller?.close();
}
