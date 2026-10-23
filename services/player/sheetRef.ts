import type BottomSheet from '@gorhom/bottom-sheet';
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

export interface PlayerOrigin extends PlayerRect {
  /** Window rect of the mini player's artwork, for the flying artwork. */
  artwork?: PlayerRect;
}

/**
 * Imperative handle the active player container registers. Either the gorhom
 * sheet (adapted below) or the morphing PlayerSurface.
 */
export interface PlayerSheetController {
  expand: (origin?: PlayerOrigin) => void;
  close: () => void;
  /**
   * Swipe-up-to-open pan for the mini player, driving the open with the
   * finger. Only the morphing surface supplies one.
   */
  createOpenGesture?: () => PanGesture;
}

type AnchorMeasurer = (done: (origin?: PlayerOrigin) => void) => void;

/**
 * The mounted mini player (iOS bottom accessory, Android pill or tablet dock)
 * registers how to measure itself, so the morphing surface can open from and
 * close onto wherever it currently sits, whoever triggered the open.
 */
let _anchor: AnchorMeasurer | null = null;

export function registerMiniPlayerAnchor(measure: AnchorMeasurer) {
  _anchor = measure;
}

export function unregisterMiniPlayerAnchor(measure: AnchorMeasurer) {
  if (_anchor === measure) _anchor = null;
}

/** Measures the mounted mini player; `done()` gets undefined if none. */
export function measureMiniPlayerAnchor(done: (origin?: PlayerOrigin) => void) {
  if (!_anchor) {
    done(undefined);
    return;
  }
  _anchor(done);
}

/**
 * Module-scope holder for the active player container.
 *
 * This decouples the imperative expand/close calls from the Zustand
 * sheetMode state, fixing the gorhom v5 edge case where a gesture-driven
 * close skips the onChange callback (when the drag position exactly equals
 * the closed detent — no animation runs, so animateToPositionCompleted
 * never fires).
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

/** Adapts the gorhom BottomSheet ref to the controller interface. */
export function registerPlayerSheetRef(
  ref: React.RefObject<BottomSheet | null>,
): PlayerSheetController {
  const controller: PlayerSheetController = {
    expand: () => ref.current?.expand(),
    close: () => ref.current?.close(),
  };
  registerPlayerSheetController(controller);
  return controller;
}

/**
 * Expand the player. Always calls the imperative expand() AND sets sheetMode
 * to 'full', so even if sheetMode was stale (stuck on 'full' from a missed
 * onChange), the player still opens. `origin` is the tapped mini player's
 * window rect; the gorhom sheet ignores it.
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
