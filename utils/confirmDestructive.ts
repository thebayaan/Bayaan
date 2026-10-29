// @ai-generated
import {Alert} from 'react-native';

export interface ConfirmDestructiveOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void | Promise<void>;
}

/**
 * Show a Cancel / destructive-confirm alert before a bulk removal, matching
 * the pattern used in Settings → Storage. `onConfirm` only runs once the user
 * taps the destructive button; a rejected promise is logged rather than left
 * unhandled (the stores already record their own error state).
 */
export function confirmDestructive({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
}: ConfirmDestructiveOptions): void {
  Alert.alert(title, message, [
    {text: cancelText, style: 'cancel'},
    {
      text: confirmText,
      style: 'destructive',
      onPress: () => {
        Promise.resolve()
          .then(onConfirm)
          .catch(error => {
            console.error(`Error after confirming "${title}":`, error);
          });
      },
    },
  ]);
}
