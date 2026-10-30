// @ai-generated
import type {SheetProps} from 'react-native-actions-sheet';
import {showSheet} from './sheetControl';
import {useMushafRangePickStore} from '@/store/mushafRangePickStore';

type VerseActionsPayload = NonNullable<SheetProps<'verse-actions'>['payload']>;

/**
 * Opens the verse actions sheet: a native sheet on iPhone with
 * `nativeSheetsEnabled` (the page behind stays live, so tapping another
 * verse swaps the sheet's content), the react-native-actions-sheet sheet
 * elsewhere. While the Listen sheet's "pick on the page" is active, the
 * selection goes to that pick instead.
 */
export function showVerseActions(payload: VerseActionsPayload): void {
  // Picking a range for the Listen sheet: the selection is the pick.
  const {consumer} = useMushafRangePickStore.getState();
  if (consumer) {
    consumer(payload);
    return;
  }
  showSheet('verse-actions', {payload}).catch(error => {
    console.warn('[showVerseActions] Failed to show sheet:', error);
  });
}
