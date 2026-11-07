// @ai-generated
import {ActionSheetIOS, Alert, Platform} from 'react-native';
import {getRecentTouch, type TouchPoint} from '@/utils/lastTouch';

export interface ConfirmDestructiveOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void | Promise<void>;
}

export interface PendingConfirmation extends ConfirmDestructiveOptions {
  /** Where the dialog points from on iPad: the touch that asked for it. */
  anchor: TouchPoint | null;
}

type Listener = (pending: PendingConfirmation | null) => void;
let listener: Listener | null = null;

/**
 * Lets `ConfirmationDialogHost` (mounted once at the root on iPad) take
 * confirmations. Returns the unsubscribe.
 */
export function setConfirmationListener(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

/** Runs the confirmed action, logging a rejection instead of leaving it. */
export function runConfirmed({title, onConfirm}: ConfirmDestructiveOptions) {
  Promise.resolve()
    .then(onConfirm)
    .catch(error => {
      console.error(`Error after confirming "${title}":`, error);
    });
}

/**
 * Show a Cancel / destructive-confirm prompt before a removal, matching the
 * pattern used in Settings → Storage. `onConfirm` only runs once the user
 * taps the destructive button; a rejected promise is logged rather than left
 * unhandled (the stores already record their own error state).
 *
 * On iPad it is a native confirmation dialog pointing at the button that
 * asked (a popover). On iPhone it is an action sheet rising from the bottom:
 * a SwiftUI dialog there would present from its host as an arrowed popover
 * on iOS 26, and a tap inside a native menu leaves no anchor to point at.
 * Elsewhere an alert.
 */
export function confirmDestructive(options: ConfirmDestructiveOptions): void {
  const {title, message, confirmText, cancelText} = options;
  if (Platform.OS === 'ios' && Platform.isPad && listener) {
    listener({...options, anchor: getRecentTouch()});
    return;
  }
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: [confirmText, cancelText],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      index => {
        if (index === 0) runConfirmed(options);
      },
    );
    return;
  }
  Alert.alert(title, message, [
    {text: cancelText, style: 'cancel'},
    {
      text: confirmText,
      style: 'destructive',
      onPress: () => runConfirmed(options),
    },
  ]);
}
