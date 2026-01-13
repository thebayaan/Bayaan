import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const LAST_SEEN_VERSION_KEY = '@bayaan_last_seen_version';
const FIRST_INSTALL_KEY = '@bayaan_first_install';

/**
 * Get the current app version from Expo config
 */
export function getCurrentVersion(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

/**
 * Get the last version that the user saw
 */
export async function getLastSeenVersion(): Promise<string | null> {
  try {
    const lastVersion = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
    return lastVersion;
  } catch (error) {
    console.error('[VersionUtils] Failed to get last seen version:', error);
    return null;
  }
}

/**
 * Check if this is the first time the app is being installed
 */
export async function isFirstInstall(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(FIRST_INSTALL_KEY);
    if (!flag) {
      await AsyncStorage.setItem(FIRST_INSTALL_KEY, 'true');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[VersionUtils] Failed to check first install:', error);
    return false;
  }
}

/**
 * Check if the app version has changed since the last launch
 * Returns false on first install, true on updates
 */
export async function hasVersionChanged(): Promise<boolean> {
  try {
    const currentVersion = getCurrentVersion();
    const lastSeenVersion = await getLastSeenVersion();
    const firstInstall = await isFirstInstall();

    // Don't show on first install
    if (firstInstall) {
      await markVersionAsSeen();
      return false;
    }

    // Show if no version seen (updating from pre-changelog version)
    if (!lastSeenVersion) {
      return true;
    }

    // Compare versions
    return currentVersion !== lastSeenVersion;
  } catch (error) {
    console.error('[VersionUtils] Failed to check version change:', error);
    return false;
  }
}

/**
 * Mark the current version as seen by the user
 */
export async function markVersionAsSeen(): Promise<void> {
  try {
    const currentVersion = getCurrentVersion();
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
    console.log('[VersionUtils] Marked version as seen:', currentVersion);
  } catch (error) {
    console.error('[VersionUtils] Failed to mark version as seen:', error);
  }
}

/**
 * Reset the version tracking (useful for testing)
 */
export async function resetVersionTracking(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_SEEN_VERSION_KEY);
    console.log('[VersionUtils] Version tracking reset');
  } catch (error) {
    console.error('[VersionUtils] Failed to reset version tracking:', error);
  }
}
