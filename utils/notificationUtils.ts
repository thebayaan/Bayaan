import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

/**
 * Registers the device for push notifications and returns the token
 * @returns Promise with the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | undefined
> {
  let token;

  // Check if the app is running on a physical device (not simulator/emulator)
  if (Device.isDevice) {
    // Check current permission status
    const {status: existingStatus} = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If permissions haven't been determined yet, request them
    if (existingStatus !== 'granted') {
      const {status} = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // If permission is not granted, return undefined
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return undefined;
    }

    // Get the token
    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })
    ).data;
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  // Set up notification channels for Android
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

/**
 * Configure notification handling behavior
 */
export function configurePushNotifications(): void {
  // Set how notifications are handled when the app is in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
