import {Platform, Linking} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// App Store IDs
const APP_STORE_ID = '6648769980'; // iOS App Store ID
const PLAY_STORE_ID = 'com.bayaan.app'; // Android package name

// Storage key for tracking if user has rated the app
const RATED_KEY = '@Bayaan:hasRated';

/**
 * Opens the appropriate app store for the user to write a review
 */
export async function openAppStoreForReview(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      // For iOS - direct to write review page
      await Linking.openURL(
        `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
      );
    } else if (Platform.OS === 'android') {
      // For Android - direct to Play Store with review section open
      await Linking.openURL(
        `market://details?id=${PLAY_STORE_ID}&showAllReviews=true`,
      );
    }
  } catch (error) {
    console.error('Could not open store URL:', error);
    // Fallback to web URLs if app store deep links fail
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL(`https://apps.apple.com/app/id${APP_STORE_ID}`);
      } else if (Platform.OS === 'android') {
        await Linking.openURL(
          `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`,
        );
      }
    } catch (secondError) {
      console.error('Could not open fallback URL:', secondError);
    }
  }
}

/**
 * Marks that the user has rated the app
 */
export async function markAsRated(): Promise<void> {
  try {
    await AsyncStorage.setItem(RATED_KEY, 'true');
  } catch (error) {
    console.error('Error saving rating status:', error);
  }
}

/**
 * Checks if the user has already rated the app
 */
export async function hasUserRated(): Promise<boolean> {
  try {
    const rated = await AsyncStorage.getItem(RATED_KEY);
    return rated === 'true';
  } catch (error) {
    console.error('Error checking rating status:', error);
    return false;
  }
}
