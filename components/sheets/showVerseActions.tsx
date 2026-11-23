// @ai-generated
import type {SheetProps} from 'react-native-actions-sheet';
import {showSheet} from './sheetControl';

type VerseActionsPayload = NonNullable<SheetProps<'verse-actions'>['payload']>;

/**
 * Opens the verse actions sheet: a native sheet on iPhone with
 * `nativeSheetsEnabled` (the page behind stays live, so tapping another
 * verse swaps the sheet's content), the react-native-actions-sheet sheet
 * elsewhere.
 */
export function showVerseActions(payload: VerseActionsPayload): void {
  showSheet('verse-actions', {payload}).catch(error => {
    console.warn('[showVerseActions] Failed to show sheet:', error);
  });
}
