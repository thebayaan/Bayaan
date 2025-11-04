import {usePlayerStore} from '@/store/playerStore';
import {useLovedStore} from '../store/lovedStore';

interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
}

/**
 * Migrates favorite tracks from the old playerStore to the new lovedStore
 * @returns {Promise<MigrationResult>} The result of the migration
 */
export async function migrateFavoritesToLoved(): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get old favorites
    const playerStore = usePlayerStore.getState();
    const oldFavorites = playerStore.favoriteTrackIds;

    // Get loved store
    const lovedStore = useLovedStore.getState();

    // Migrate each favorite
    for (const favoriteKey of oldFavorites) {
      try {
        const [reciterId, surahId] = favoriteKey.split(':');
        
        // Skip if already loved
        if (lovedStore.isLoved(reciterId, surahId)) {
          result.skipped++;
          continue;
        }

        // Add to loved tracks
        lovedStore.toggleLoved(reciterId, surahId);
        result.migrated++;
      } catch (error) {
        result.errors.push(`Failed to migrate track ${favoriteKey}: ${error}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Error migrating favorite tracks:', error);
    result.errors.push(`Global migration error: ${error}`);
    return result;
  }
}

/**
 * Cleans up old favorites after successful migration
 * This should only be called after verifying the migration was successful
 * @returns {Promise<void>}
 */
export async function cleanupOldFavorites(): Promise<void> {
  try {
    const playerStore = usePlayerStore.getState();
    
    // Clear old favorites array
    playerStore.toggleFavoriteTrack = () => {}; // No-op the toggle function
    // @ts-ignore - We know this exists from the store type
    playerStore.favoriteTrackIds = [];
  } catch (error) {
    console.error('Error cleaning up old favorites:', error);
    throw error;
  }
}

/**
 * Validates the migration by comparing old favorites with new loved tracks
 * @returns {Promise<boolean>} True if migration is valid
 */
export async function validateMigration(): Promise<boolean> {
  try {
    const playerStore = usePlayerStore.getState();
    const lovedStore = useLovedStore.getState();
    const oldFavorites = playerStore.favoriteTrackIds;

    // Check that all old favorites are in loved tracks
    for (const favoriteKey of oldFavorites) {
      const [reciterId, surahId] = favoriteKey.split(':');
      if (!lovedStore.isLoved(reciterId, surahId)) {
        console.error(`Migration validation failed: ${favoriteKey} not found in loved tracks`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating migration:', error);
    return false;
  }
} 