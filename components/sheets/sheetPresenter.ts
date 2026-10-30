// @ai-generated
import {createContext, useContext, type ComponentType} from 'react';
import type {SheetProps} from 'react-native-actions-sheet';

/**
 * How a sheet registered with react-native-actions-sheet was presented when
 * it is shown natively instead (`NativeSheetHost`). A sheet that finds one
 * renders its content without the ActionSheet wrapper and hides through it,
 * so its `await hide()` still resolves only once it is fully gone.
 */
export interface SheetPresenter {
  hide: () => Promise<void>;
}

export const SheetPresenterContext = createContext<SheetPresenter | null>(null);

/** Null when the sheet is on react-native-actions-sheet as usual. */
export function useSheetPresenter(): SheetPresenter | null {
  return useContext(SheetPresenterContext);
}

let verseActionsSheet: ComponentType<SheetProps<'verse-actions'>> | null = null;

/**
 * `sheets.tsx` hands over the verse actions sheet here, so opening it
 * natively doesn't pull the sheet and its stores into every caller.
 */
export function setNativeVerseActionsSheet(
  sheet: ComponentType<SheetProps<'verse-actions'>>,
): void {
  verseActionsSheet = sheet;
}

export function getNativeVerseActionsSheet(): ComponentType<
  SheetProps<'verse-actions'>
> | null {
  return verseActionsSheet;
}
