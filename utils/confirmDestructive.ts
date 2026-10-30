// @ai-generated
import {Alert, Platform} from 'react-native';
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
 * On iOS it is a native confirmation dialog: an action sheet on iPhone, and
 * on iPad a popover pointing at the button that asked. Elsewhere an alert.
 */
export function confirmDestructive(options: ConfirmDestructiveOptions): void {
  if (Platform.OS === 'ios' && listener) {
    listener({...options, anchor: getRecentTouch()});
    return;
  }
  const {title, message, confirmText, cancelText} = options;
  Alert.alert(title, message, [
    {text: cancelText, style: 'cancel'},
    {
      text: confirmText,
      style: 'destructive',
      onPress: () => runConfirmed(options),
    },
  ]);
}
