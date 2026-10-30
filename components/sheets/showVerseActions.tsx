// @ai-generated
import React from 'react';
import {Platform} from 'react-native';
import {SheetManager, type SheetProps} from 'react-native-actions-sheet';
import {
  hideNativeSheet,
  nativeSheetsEnabled,
  presentNativeSheet,
} from '@/components/native/nativeSheets';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {
  getNativeVerseActionsSheet,
  SheetPresenterContext,
  type SheetPresenter,
} from './sheetPresenter';

type VerseActionsPayload = NonNullable<SheetProps<'verse-actions'>['payload']>;

const nativePresenter: SheetPresenter = {hide: hideNativeSheet};
let presentation = 0;

function clearVerseSelection() {
  useVerseSelectionStore.getState().clearSelection();
  useMushafVerseSelectionStore.getState().clearSelection();
}

/**
 * Opens the verse actions sheet. On iPhone with `nativeSheetsEnabled` it is
 * a SwiftUI sheet that keeps the page behind live, so tapping another verse
 * swaps the sheet's content; elsewhere it is the react-native-actions-sheet
 * sheet. iPad keeps its centred card.
 */
export function showVerseActions(payload: VerseActionsPayload): void {
  const VerseActionsSheet = getNativeVerseActionsSheet();
  if (
    VerseActionsSheet &&
    nativeSheetsEnabled &&
    Platform.OS === 'ios' &&
    !Platform.isPad
  ) {
    presentation += 1;
    const presented = presentNativeSheet(
      <SheetPresenterContext.Provider
        key={presentation}
        value={nativePresenter}>
        <VerseActionsSheet sheetId="verse-actions" payload={payload} />
      </SheetPresenterContext.Provider>,
      clearVerseSelection,
    );
    if (presented) return;
  }
  SheetManager.show('verse-actions', {payload});
}
