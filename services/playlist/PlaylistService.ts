import {
  databaseService,
  UserPlaylist,
  PlaylistItem,
} from '@/services/database/DatabaseService';

// Re-export types for convenience
export type {UserPlaylist, PlaylistItem};

// @ai-start
// The time alone repeats when two things are made in the same millisecond
// (a double tap, or a new playlist and its first item). The second insert
// then failed on the primary key and its save was lost.
function uniqueId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}
// @ai-end

class PlaylistService {
  private initPromise: Promise<void> | null = null;

  // Initialize the service (idempotent with mutex protection)
  async initialize(): Promise<void> {
    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    // @ai-start
    // Forget a failed open, so the next call tries again. Kept, the failure
    // was handed to every later call and collections stayed broken until
    // the app was restarted.
    this.initPromise = databaseService.initialize().catch(error => {
      this.initPromise = null;
      throw error;
    });
    // @ai-end
    return this.initPromise;
  }

  // Create a new playlist
  async createPlaylist(
    name: string,
    color: string,
    description?: string,
  ): Promise<UserPlaylist> {
    await this.initialize();

    const playlist: Omit<UserPlaylist, 'itemCount'> = {
      id: uniqueId('playlist'), // @ai
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

  // @ai-start
  // Tail of the adds. "Is it already in the playlist?" and the insert are
  // two steps, so two adds of the same surah issued together (a double tap
  // on a playlist row) both saw "no" and both inserted. Each add now starts
  // once the one before it is done, and the second one finds the first.
  private addQueue: Promise<unknown> = Promise.resolve();

  // Add item to playlist
  addToPlaylist(
    playlistId: string,
    surahId: string,
    reciterId: string,
    rewayatId?: string,
    userRecitationId?: string,
  ): Promise<void> {
    const add = () =>
      this.addToPlaylistNow(
        playlistId,
        surahId,
        reciterId,
        rewayatId,
        userRecitationId,
      );
    const result = this.addQueue.then(add, add);
    this.addQueue = result.catch(() => undefined);
    return result;
  }
  // @ai-end

  private async addToPlaylistNow(
    playlistId: string,
    surahId: string,
    reciterId: string,
    rewayatId?: string,
    userRecitationId?: string,
  ): Promise<void> {
    await this.initialize();

    // Check if item already exists (read operation - OK to be outside transaction)
    const existingItems = await databaseService.getPlaylistItems(playlistId);
    // @ai-start
    // An upload is its own item. Without its id in the comparison, an
    // upload could not be added next to the catalogue recording of the same
    // surah, and a second upload of the same surah could not be added at all.
    const existingItem = existingItems.find(
      item =>
        item.surahId === surahId &&
        item.reciterId === reciterId &&
        (item.rewayatId || undefined) === (rewayatId || undefined) &&
        (item.userRecitationId || undefined) ===
          (userRecitationId || undefined),
    );
    // @ai-end

    if (existingItem) return; // Don't add duplicates

    const orderIndex = await databaseService.getNextOrderIndex(playlistId);
    const item: PlaylistItem = {
      id: uniqueId('item'), // @ai
      playlistId,
      surahId,
      reciterId,
      rewayatId,
      orderIndex,
      addedAt: Date.now(),
      userRecitationId,
    };

    // Wrap both operations in a single transaction
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

  // @ai-start
  /** Removes deleted uploads from every playlist; returns the item count. */
  async removeUploads(userRecitationIds: readonly string[]): Promise<number> {
    if (userRecitationIds.length === 0) return 0;
    await this.initialize();
    return await databaseService.removeItemsForUploads(userRecitationIds);
  }
  // @ai-end

  // Delete playlist
  async deletePlaylist(playlistId: string): Promise<void> {
    await this.initialize();
    await databaseService.deletePlaylist(playlistId);
  }

  // Update playlist
  async updatePlaylist(
    id: string,
    updates: Partial<UserPlaylist>,
  ): Promise<UserPlaylist | null> {
    await this.initialize();
    await databaseService.updatePlaylist(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return await databaseService.getPlaylist(id);
  }

  // Reorder playlist items
  async reorderPlaylistItems(
    playlistId: string,
    itemIds: string[],
  ): Promise<void> {
    await this.initialize();
    await databaseService.reorderPlaylistItems(playlistId, itemIds);
  }
}

// Export singleton instance
export const playlistService = new PlaylistService();
