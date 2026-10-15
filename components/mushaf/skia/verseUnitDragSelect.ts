// @ai-generated
/**
 * Long-press and drag-select on a mushaf page in verse units (decision 3 of
 * Release 1), shared by both page renderers (SkiaPage, ContinuousMushafView)
 * so that they select exactly the same thing:
 *  - long-press selects the verse unit under the finger: the shown
 *    rewayah's OWN verse (in Warsh, the second half of Hafs 1:7 is Warsh
 *    1:7, not Hafs 1:7), with its Hafs storage anchor; nothing on the
 *    unnumbered Fatiha basmala of the Madani / Basri counts;
 *  - the iOS drag extends the selection forward over consecutive units of
 *    the page (reading order), never back past the start; Android selects
 *    the pressed unit only (its long-press does not drag);
 *  - releasing opens the verse actions with the units' payload (verse-units
 *    contract 4.1: unit keys + rewayah, Hafs fields with their Hafs
 *    meaning);
 *  - while the shown text's units are still being built (right after a
 *    rewayah switch) there is no unit to select: a long-press on the text
 *    says so (a toast) instead of doing nothing.
 * A renderer supplies only where a touch lands in its line text (its own
 * paragraph metrics); which unit that is, the drag order and the payload
 * are decided here, from MushafVerseMapService's unit segments.
 */
import {useCallback, useMemo, useRef} from 'react';
import {Platform} from 'react-native';
import * as Haptics from 'expo-haptics';
import {SheetManager} from 'react-native-actions-sheet';
import {
  mushafVerseMapService,
  selectionForUnitKeys,
} from '@/services/mushaf/MushafVerseMapService';
import {
  useMushafVerseSelectionStore,
  verseActionsPayloadForUnits,
} from '@/store/mushafVerseSelectionStore';
import {showToast} from '@/utils/toastUtils';

/** Where a touch lands in a page's line text. */
export interface LineCharHit {
  lineIndex: number;
  /** Index into the line text the renderer draws (getLineText). */
  charIndex: number;
}

/** The gesture callbacks a renderer wires to its long-press / pan. */
export interface VerseUnitDragHandlers {
  onDragStart: (x: number, y: number) => void;
  onDragUpdate: (x: number, y: number) => void;
  onDragEnd: () => void;
}

/**
 * The long-press / drag-select handlers of page `pageNumber`. `charAt` maps
 * a touch point to the line and character under it, or null outside the
 * text. Units and their order are read from MushafVerseMapService at the
 * time of the gesture: its caches follow the rendered text (rewayah and
 * words), so nothing here needs to re-render with it.
 */
export function useVerseUnitDragSelect(
  pageNumber: number,
  charAt: (x: number, y: number) => LineCharHit | null,
): VerseUnitDragHandlers {
  const selectUnits = useMushafVerseSelectionStore(s => s.selectUnits);

  // Drag state in refs (no re-render during a drag).
  const startKeyRef = useRef<string | null>(null);
  const currentKeyRef = useRef<string | null>(null);

  /** The unit under a touch point (null on the unnumbered basmala). */
  const unitKeyAt = useCallback(
    (x: number, y: number): string | null => {
      const hit = charAt(x, y);
      if (!hit) return null;
      return (
        mushafVerseMapService.findUnitAtCharIndex(
          pageNumber,
          hit.lineIndex,
          hit.charIndex,
        )?.verseKey ?? null
      );
    },
    [charAt, pageNumber],
  );

  /** Selects units of the shown text (keys + rewayah + anchors). */
  const selectUnitKeys = useCallback(
    (unitKeys: string[]) => {
      const selection = selectionForUnitKeys(unitKeys);
      if (selection) {
        selectUnits(selection.rewayah, selection.units, pageNumber);
      }
    },
    [selectUnits, pageNumber],
  );

  const onDragStart = useCallback(
    (x: number, y: number) => {
      const key = unitKeyAt(x, y);
      startKeyRef.current = key;
      if (!key) {
        if (charAt(x, y) && mushafVerseMapService.isShownVerseUnitsPending()) {
          showToast('Preparing verses', 'Try again in a moment.', 'none');
        }
        return;
      }
      currentKeyRef.current = key;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      selectUnitKeys([key]);
    },
    [unitKeyAt, charAt, selectUnitKeys],
  );

  // Extends the selection (disabled on Android to avoid gesture conflicts).
  const onDragUpdate = useCallback(
    (x: number, y: number) => {
      if (Platform.OS === 'android') return;
      const startKey = startKeyRef.current;
      if (!startKey) return;

      const currentKey = unitKeyAt(x, y);
      if (!currentKey || currentKey === currentKeyRef.current) return;

      // Verse UNIT keys of the page in reading order.
      const ordered =
        mushafVerseMapService.getOrderedUnitKeysForPage(pageNumber);
      const startIdx = ordered.indexOf(startKey);
      const currentIdx = ordered.indexOf(currentKey);
      if (startIdx === -1 || currentIdx === -1) return;

      // Only forward (downward) selection: above the start keeps the start.
      if (currentIdx < startIdx) {
        if (currentKeyRef.current !== startKey) {
          currentKeyRef.current = startKey;
          selectUnitKeys([startKey]);
        }
        return;
      }

      currentKeyRef.current = currentKey;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Consecutive units of the page, start..current (reading order).
      selectUnitKeys(ordered.slice(startIdx, currentIdx + 1));
    },
    [unitKeyAt, selectUnitKeys, pageNumber],
  );

  // Opens the verse actions for what is selected.
  const onDragEnd = useCallback(() => {
    if (!startKeyRef.current) return;
    const {selectedRewayah, selectedUnits} =
      useMushafVerseSelectionStore.getState();
    const payload = selectedRewayah
      ? verseActionsPayloadForUnits(selectedRewayah, selectedUnits)
      : null;
    if (!payload) return;

    SheetManager.show('verse-actions', {payload});
    startKeyRef.current = null;
    currentKeyRef.current = null;
  }, []);

  return useMemo(
    () => ({onDragStart, onDragUpdate, onDragEnd}),
    [onDragStart, onDragUpdate, onDragEnd],
  );
}
