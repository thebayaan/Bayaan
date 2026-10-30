// @ai-generated
import React, {type ComponentType} from 'react';
import {Platform} from 'react-native';
import {
  SheetManager,
  type SheetProps,
  type Sheets,
} from 'react-native-actions-sheet';
import {
  getNativeSheetLevels,
  hasNativeSheet,
  hideNativeSheet,
  isNativeSheetPresented,
  nativeSheetsEnabled,
  presentNativeSheet,
} from '@/components/native/nativeSheets';

type SheetId = keyof Sheets;
type Payload<Id extends SheetId> = Sheets[Id]['payload'];
type ReturnValue<Id extends SheetId> = Sheets[Id]['returnValue'];

// Each entry renders its own sheet's props; the map erases the id.
const nativeSheets = new Map<string, ComponentType<SheetProps<never>>>();

/**
 * `sheets.tsx` registers the sheets that may present natively, next to
 * their react-native-actions-sheet registration.
 */
export function registerNativeSheet<Id extends SheetId>(
  id: Id,
  Sheet: ComponentType<SheetProps<Id>>,
): void {
  nativeSheets.set(id, Sheet as ComponentType<SheetProps<never>>);
}

function nativeSheetFor(id: string) {
  if (!nativeSheetsEnabled || Platform.OS !== 'ios' || Platform.isPad) {
    return undefined;
  }
  return nativeSheets.get(id);
}

/**
 * `SheetManager.show` that presents registered sheets as SwiftUI sheets on
 * iPhone (with `nativeSheetsEnabled`). A sheet opened while a native one is
 * up stacks on it, as react-native-actions-sheet sheets do. Resolves with
 * the value the sheet is hidden with.
 */
export function showSheet<Id extends SheetId>(
  id: Id,
  options?: {payload?: Payload<Id>},
): Promise<ReturnValue<Id>> {
  const Sheet = nativeSheetFor(id);
  if (Sheet) {
    const shown = presentNativeSheet(
      id,
      <Sheet sheetId={id} payload={options?.payload as never} />,
      hasNativeSheet(),
    );
    if (shown) return shown as Promise<ReturnValue<Id>>;
  }
  if (hasNativeSheet()) {
    // A React Native modal can't present while a native sheet is up (it
    // fails and leaves the screen unresponsive), so close the native sheets
    // first.
    return closeNativeSheets().then(() =>
      SheetManager.show(id, options as never),
    ) as Promise<ReturnValue<Id>>;
  }
  return SheetManager.show(id, options as never) as Promise<ReturnValue<Id>>;
}

/**
 * `SheetManager.hide` for either kind of sheet. Resolves once the sheet is
 * gone.
 */
export function hideSheet<Id extends SheetId>(
  id: Id,
  options?: {payload?: ReturnValue<Id>},
): Promise<unknown> {
  if (isNativeSheetPresented(id)) {
    return hideNativeSheet(id, options?.payload);
  }
  return SheetManager.hide(id, options as never);
}

function closeNativeSheets(): Promise<void> {
  // Hiding the bottom level takes the ones above it with it.
  const bottom = getNativeSheetLevels().find(level => level.presented);
  return bottom ? hideNativeSheet(bottom.id) : Promise.resolve();
}
