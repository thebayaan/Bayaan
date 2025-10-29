import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
import {databaseService, UserPlaylist, PlaylistItem} from '@/services/database/DatabaseService';

// Re-export types for convenience
export type {UserPlaylist, PlaylistItem};

class PlaylistService {
  private initialized = false;

  // Initialize the service
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await databaseService.initialize();
      this.initialized = true;
    }
  }

  // Create a new playlist
  async createPlaylist(name: string, color: string, description?: string): Promise<UserPlaylist> {
    await this.initialize();
    
    const playlist: Omit<UserPlaylist, 'itemCount'> = {
      id: `playlist_${Date.now()}`,
      name,
      description,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await databaseService.createPlaylist(playlist);
    return {
      ...playlist,
      itemCount: 0,
    };
  }

  // Get all playlists
  async getAllPlaylists(): Promise<UserPlaylist[]> {
    await this.initialize();
    return await databaseService.getAllPlaylists();
  }

  // Get playlist by ID
  async getPlaylist(id: string): Promise<UserPlaylist | null> {
    await this.initialize();
    return await databaseService.getPlaylist(id);
  }

  // Add item to playlist
  async addToPlaylist(
    playlistId: string,
    surahId: string,
    reciterId: string,
    rewayatId?: string,
  ): Promise<void> {
    await this.initialize();

    // Check if item already exists
    const existingItems = await databaseService.getPlaylistItems(playlistId);
    const existingItem = existingItems.find(
      item =>
        item.surahId === surahId &&
        item.reciterId === reciterId &&
        item.rewayatId === rewayatId,
    );

    if (existingItem) return; // Don't add duplicates

    const orderIndex = await databaseService.getNextOrderIndex(playlistId);
    const item: PlaylistItem = {
      id: `item_${Date.now()}`,
      playlistId,
      surahId,
      reciterId,
      rewayatId,
      orderIndex,
      addedAt: Date.now(),
    };

    await databaseService.addPlaylistItem(item);
    await databaseService.updatePlaylist(playlistId, {updatedAt: Date.now()});
  }

  // Get playlist items
  async getPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    await this.initialize();
    return await databaseService.getPlaylistItems(playlistId);
  }

  // Remove item from playlist
  async removeFromPlaylist(itemId: string): Promise<void> {
    await this.initialize();
    await databaseService.removePlaylistItem(itemId);
  }

  // Delete playlist
  async deletePlaylist(playlistId: string): Promise<void> {
    await this.initialize();
    await databaseService.deletePlaylist(playlistId);
  }

  // Update playlist
  async updatePlaylist(id: string, updates: Partial<UserPlaylist>): Promise<UserPlaylist | null> {
    await this.initialize();
    await databaseService.updatePlaylist(id, {...updates, updatedAt: Date.now()});
    return await databaseService.getPlaylist(id);
  }

  // Reorder playlist items
  async reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<void> {
    await this.initialize();
    await databaseService.reorderPlaylistItems(playlistId, itemIds);
  }
}

// Export singleton instance
export const playlistService = new PlaylistService();
