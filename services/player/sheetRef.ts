import type BottomSheet from '@gorhom/bottom-sheet';
import {usePlayerStore} from './store/playerStore';

/**
 * Module-scope holder for the player BottomSheet ref.
 *
 * This decouples the imperative expand/close calls from the Zustand
 * sheetMode state, fixing the gorhom v5 edge case where a gesture-driven
 * close skips the onChange callback (when the drag position exactly equals
 * the closed detent — no animation runs, so animateToPositionCompleted
 * never fires).
 */
let _sheetRef: React.RefObject<BottomSheet | null> | null = null;

export function registerPlayerSheetRef(
  ref: React.RefObject<BottomSheet | null>,
) {
  _sheetRef = ref;
}

export function unregisterPlayerSheetRef() {
  _sheetRef = null;
}

/**
 * Expand the player sheet. Always calls the imperative expand() method
 * AND sets sheetMode to 'full', so even if sheetMode was stale (stuck
 * on 'full' from a missed onChange), the sheet still opens.
 */
export function expandPlayerSheet() {
  usePlayerStore.getState().setSheetMode('full');
  _sheetRef?.current?.expand();
}

/**
 * Close the player sheet imperatively and sync store state.
 */
export function closePlayerSheet() {
  usePlayerStore.getState().setSheetMode('hidden');
  _sheetRef?.current?.close();
}
