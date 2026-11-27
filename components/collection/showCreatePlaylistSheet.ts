// @ai-generated
import {type Sheets} from 'react-native-actions-sheet';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai

type CreatePlaylistPayload = Sheets['create-playlist']['payload'];
type CreatePlaylistResult = Sheets['create-playlist']['returnValue'];

let isOpen = false;

/**
 * Opens the create / rename playlist sheet and resolves with what was saved
 * (undefined when it was dismissed).
 *
 * The sheet manager's show() adds a close listener per call. A double tap on
 * "Create new playlist" or "Edit" therefore opened one sheet but resolved
 * twice with the same name, and the two saves ran in the same tick. A call
 * made while the sheet is already open now resolves undefined right away,
 * so each sheet gives exactly one result.
 */
export async function showCreatePlaylistSheet(
  payload: CreatePlaylistPayload,
): Promise<CreatePlaylistResult> {
  if (isOpen) return undefined;
  isOpen = true;
  try {
    return await showSheet('create-playlist', {payload});
  } finally {
    isOpen = false;
  }
}
