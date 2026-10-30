// @ai-generated
import type {ReactNode} from 'react';

/**
 * Sheets presented as SwiftUI sheets on iPhone (detents, the system grabber,
 * the page behind kept live up to the medium detent). Off: every sheet stays
 * on react-native-actions-sheet. Only the verse actions sheet uses it so far.
 */
export const nativeSheetsEnabled = false;

interface SheetHost {
  present: (content: ReactNode) => void;
  dismiss: () => void;
}

let host: SheetHost | null = null;
let presented = false;
let dismissWaiters: (() => void)[] = [];
let onDismissed: (() => void) | undefined;

/** `NativeSheetHost` (mounted once at the root on iOS) registers here. */
export function setNativeSheetHost(next: SheetHost): () => void {
  host = next;
  return () => {
    if (host === next) host = null;
  };
}

/** The host calls this once the sheet has finished dismissing. */
export function notifyNativeSheetDismissed(): void {
  presented = false;
  const callback = onDismissed;
  onDismissed = undefined;
  callback?.();
  const waiters = dismissWaiters;
  dismissWaiters = [];
  waiters.forEach(resolve => resolve());
}

/**
 * Presents `content` in the native sheet, replacing what it shows if one is
 * already up. `onDismiss` runs once the sheet is gone (the latest one wins
 * when the content is replaced). Returns false when no host is mounted, so
 * callers fall back to their React Native sheet.
 */
export function presentNativeSheet(
  content: ReactNode,
  onDismiss?: () => void,
): boolean {
  if (!host) return false;
  presented = true;
  onDismissed = onDismiss;
  host.present(content);
  return true;
}

/**
 * Dismisses the native sheet. Resolves once it is fully gone, so a React
 * Native modal shown next never races its dismissal (a modal presented while
 * a native presentation is up fails and leaves the screen unresponsive).
 */
export function hideNativeSheet(): Promise<void> {
  if (!host || !presented) return Promise.resolve();
  const done = new Promise<void>(resolve => dismissWaiters.push(resolve));
  host.dismiss();
  return done;
}
