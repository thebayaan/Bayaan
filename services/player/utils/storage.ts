import AsyncStorage from '@react-native-async-storage/async-storage';
import {usePlayerStore} from '../store/playerStore';
import {useRecentlyPlayedStore} from '../store/recentlyPlayedStore';

/**
 * Clears all player-related caches and state
 * This includes:
 * - Player store state
 * - Recently played tracks
 * - All related AsyncStorage data
 * Note: Favorite reciters and loved surahs are preserved
 */
export async function clearPlayerCache(): Promise<void> {
  try {
    // Get store instances
    const playerStore = usePlayerStore.getState();
    const recentlyPlayedStore = useRecentlyPlayedStore.getState();

    // Reset all stores except favorite reciters
    await playerStore.cleanup();
    recentlyPlayedStore.reset();

    // Clear related AsyncStorage data
    const keysToRemove = [
      'player-store',
      'player-recently-played-storage',
      '@bayaan/last_track',
      '@bayaan/last_position',
    ];

    await AsyncStorage.multiRemove(keysToRemove);

    console.log('[Storage] Player cache cleared successfully');
  } catch (error) {
    console.error('[Storage] Error clearing player cache:', error);
    throw new Error('Failed to clear player cache');
  }
}
