import {Platform} from 'react-native';
import * as Burnt from 'burnt';

type ToastPreset = 'done' | 'error' | 'none';

/**
 * Show a native toast notification (cross-platform via burnt).
 *
 * - `preset` defaults to `'done'` (green checkmark). Pass `'error'` for
 *   negative events (offline, failures) so iOS shows a red exclamation
 *   indicator instead of a misleading checkmark.
 * - Android note: Burnt's Android backend wraps `Toast.makeText`, which
 *   only renders a single string — the `message` field is silently
 *   dropped. To keep the full text visible we merge `title` + `message`
 *   into one line on Android.
 */
export function showToast(
  title: string,
  message?: string,
  preset: ToastPreset = 'done',
): void {
  if (Platform.OS === 'android' && message) {
    Burnt.toast({title: `${title}: ${message}`, preset});
    return;
  }
  Burnt.toast({title, message, preset});
}
