import {Alert, Platform, ToastAndroid} from 'react-native';

/**
 * Show a toast message (Android) or alert (iOS)
 * @param message - The message to display
 * @param duration - Toast duration (Android only, default: SHORT)
 */
export function showToast(
  message: string,
  duration: number = ToastAndroid.SHORT,
): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, duration);
  } else {
    // On iOS, use Alert for now
    Alert.alert(message);
  }
}

