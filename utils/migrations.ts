import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

const MIGRATION_VERSION_KEY = 'app-migration-version';
const CURRENT_MIGRATION_VERSION = 1;

/**
 * Storage keys that may contain stale file paths or download data
 * These need to be cleaned up after TestFlight updates to prevent file corruption
 */
const DOWNLOAD_RELATED_KEYS = [
  'downloads-store', // Zustand download store with file paths
  'download-queue', // Download queue that may contain file references
  'cached-files', // Any cached file metadata
];

/**
 * Runs all necessary migrations to clean up stale data
 * This is called on app startup to ensure data integrity after updates
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('[Migrations] Starting migration process...');

    // Get current app version
    const appVersion = Constants.expoConfig?.version || '1.0.0';
    console.log('[Migrations] Current app version:', appVersion);

    // Get last migration version
    const lastMigrationVersion = await AsyncStorage.getItem(
      MIGRATION_VERSION_KEY,
    );
    const lastVersion = lastMigrationVersion
      ? parseInt(lastMigrationVersion, 10)
      : 0;

    console.log(
      '[Migrations] Last migration version:',
      lastVersion,
      'Current migration version:',
      CURRENT_MIGRATION_VERSION,
    );

    // Run migrations if needed
    if (lastVersion < CURRENT_MIGRATION_VERSION) {
      console.log('[Migrations] Running migrations...');

      // Migration 1: Clean up stale download data
      if (lastVersion < 1) {
        await cleanupStaleDownloadData();
      }

      // Update migration version
      await AsyncStorage.setItem(
        MIGRATION_VERSION_KEY,
        CURRENT_MIGRATION_VERSION.toString(),
      );
      console.log(
        '[Migrations] Migration complete. Updated to version:',
        CURRENT_MIGRATION_VERSION,
      );
    } else {
      console.log('[Migrations] No migrations needed');
    }
  } catch (error) {
    console.error('[Migrations] Error running migrations:', error);
    // Don't throw - migrations should not prevent app from starting
  }
}

/**
 * Cleans up stale download data that may contain invalid file paths
 * This fixes the TestFlight file corruption issue where absolute file paths
 * become invalid after app updates
 */
async function cleanupStaleDownloadData(): Promise<void> {
  try {
    console.log('[Migrations] Cleaning up stale download data...');

    // Get all storage keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('[Migrations] Found', allKeys.length, 'storage keys');

    // Find download-related keys
    const keysToRemove = allKeys.filter(key =>
      DOWNLOAD_RELATED_KEYS.some(pattern => key.includes(pattern)),
    );

    if (keysToRemove.length > 0) {
      console.log(
        '[Migrations] Removing',
        keysToRemove.length,
        'download-related keys:',
        keysToRemove,
      );
      await AsyncStorage.multiRemove(keysToRemove);
      console.log('[Migrations] Successfully removed stale download data');
    } else {
      console.log('[Migrations] No stale download data found');
    }

    // Validate any remaining file paths in storage
    await validateStoredFilePaths(allKeys);
  } catch (error) {
    console.error('[Migrations] Error cleaning up download data:', error);
  }
}

/**
 * Validates stored file paths and removes entries with invalid paths
 * This catches any other storage entries that might contain stale file references
 */
async function validateStoredFilePaths(allKeys: string[]): Promise<void> {
  try {
    console.log('[Migrations] Validating stored file paths...');

    for (const key of allKeys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (!value) continue;

        // Try to parse as JSON
        const parsed = JSON.parse(value);

        // Check if the value contains file paths
        if (containsFilePaths(parsed)) {
          console.log(
            '[Migrations] Found potential file paths in key:',
            key,
            'validating...',
          );

          // Validate and clean if needed
          const hasInvalidPaths = await hasInvalidFilePaths(parsed);
          if (hasInvalidPaths) {
            console.log(
              '[Migrations] Found invalid file paths in key:',
              key,
              'removing...',
            );
            await AsyncStorage.removeItem(key);
          }
        }
      } catch (error) {
        // Skip non-JSON values or parsing errors
        continue;
      }
    }

    console.log('[Migrations] File path validation complete');
  } catch (error) {
    console.error('[Migrations] Error validating file paths:', error);
  }
}

/**
 * Checks if an object contains file paths
 */
function containsFilePaths(obj: unknown): boolean {
  if (typeof obj === 'string') {
    // Check if string looks like a file path
    return (
      obj.includes('file://') ||
      obj.includes('.mp3') ||
      obj.includes('.mp4') ||
      obj.includes('DocumentDirectory') ||
      obj.includes('CacheDirectory')
    );
  }

  if (Array.isArray(obj)) {
    return obj.some(item => containsFilePaths(item));
  }

  if (obj && typeof obj === 'object') {
    return Object.values(obj).some(value => containsFilePaths(value));
  }

  return false;
}

/**
 * Checks if an object contains invalid file paths
 */
async function hasInvalidFilePaths(obj: unknown): Promise<boolean> {
  if (typeof obj === 'string' && containsFilePaths(obj)) {
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(obj);
      return !fileInfo.exists;
    } catch (error) {
      return true; // If we can't check, assume it's invalid
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (await hasInvalidFilePaths(item)) {
        return true;
      }
    }
  }

  if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      if (await hasInvalidFilePaths(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Emergency cleanup function - removes ALL download-related data
 * This can be called manually if users report continued issues
 */
export async function emergencyCleanup(): Promise<void> {
  try {
    console.log('[Migrations] Running emergency cleanup...');

    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter(
      key =>
        key.includes('download') ||
        key.includes('cache') ||
        key.includes('file'),
    );

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      console.log(
        '[Migrations] Emergency cleanup complete. Removed',
        keysToRemove.length,
        'keys',
      );
    }
  } catch (error) {
    console.error('[Migrations] Emergency cleanup failed:', error);
  }
}
