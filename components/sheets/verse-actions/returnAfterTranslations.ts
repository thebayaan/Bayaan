// @ai-generated
import {SheetManager, type SheetProps} from 'react-native-actions-sheet';

type VerseActionsPayload = NonNullable<SheetProps<'verse-actions'>['payload']>;

let pending: VerseActionsPayload | null = null;

/**
 * The verse card's settings gear has to close the card to open the
 * Translations dialog. On iPad the dialog sits over the reader, so closing
 * it should land back on the card, not on the bare page. Remember the card
 * here until the dialog closes.
 */
export function returnToVerseActionsAfterTranslations(
  payload: VerseActionsPayload,
) {
  pending = payload;
}

/** Shows the remembered verse card, once. The dialog calls it as it closes. */
export function showPendingVerseActions() {
  const payload = pending;
  pending = null;
  if (payload) {
    SheetManager.show('verse-actions', {payload});
  }
}
