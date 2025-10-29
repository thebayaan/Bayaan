import * as SQLite from 'expo-sqlite';

export interface UserPlaylist {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  itemCount: number;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  surahId: string;
  reciterId: string;
  rewayatId?: string;
  orderIndex: number;
  addedAt: number;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  // Initialize database
  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('playlists.db');
      await this.createTables();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  // Create tables
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create playlists table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create playlist items table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        surah_id TEXT NOT NULL,
        reciter_id TEXT NOT NULL,
        rewayat_id TEXT,
        order_index INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        FOREIGN KEY (playlist_id) REFERENCES user_playlists(id) ON DELETE CASCADE
      );
    `);

    // Create indexes for better performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id 
      ON playlist_items(playlist_id);
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_playlist_items_order 
      ON playlist_items(playlist_id, order_index);
    `);
  }

  // Playlist operations
  async createPlaylist(playlist: Omit<UserPlaylist, 'itemCount'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT INTO user_playlists (id, name, description, color, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [playlist.id, playlist.name, playlist.description || null, playlist.color, playlist.createdAt, playlist.updatedAt]
    );
  }

  async getAllPlaylists(): Promise<UserPlaylist[]> {
    if (!this.db) throw new Error('Database not initialized');

    const playlists = await this.db.getAllAsync(
      `SELECT id, name, description, color, created_at, updated_at FROM user_playlists ORDER BY created_at DESC`
    ) as any[];

    // Get item count for each playlist
    const playlistsWithCount = await Promise.all(
      playlists.map(async (playlist) => {
        const countResult = await this.db!.getFirstAsync(
          `SELECT COUNT(*) as count FROM playlist_items WHERE playlist_id = ?`,
          [playlist.id]
        ) as any;

        return {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          color: playlist.color,
          createdAt: playlist.created_at,
          updatedAt: playlist.updated_at,
          itemCount: countResult?.count || 0,
        };
      })
    );

    return playlistsWithCount;
  }

  async getPlaylist(id: string): Promise<UserPlaylist | null> {
    if (!this.db) throw new Error('Database not initialized');

    const playlist = await this.db.getFirstAsync(
      `SELECT id, name, description, color, created_at, updated_at FROM user_playlists WHERE id = ?`,
      [id]
    ) as any;

    if (!playlist) return null;

    // Get item count
    const countResult = await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM playlist_items WHERE playlist_id = ?`,
      [id]
    ) as any;

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      color: playlist.color,
      createdAt: playlist.created_at,
      updatedAt: playlist.updated_at,
      itemCount: countResult?.count || 0,
    };
  }

  async updatePlaylist(id: string, updates: Partial<UserPlaylist>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Map camelCase field names to snake_case column names
    const fieldMapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      color: 'color',
      updatedAt: 'updated_at',
    };

    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'itemCount')
      .map(key => `${fieldMapping[key] || key} = ?`)
      .join(', ');

    if (setClause) {
      const values = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'itemCount')
        .map(key => updates[key as keyof UserPlaylist])
        .filter(value => value !== undefined);

      await this.db.runAsync(
        `UPDATE user_playlists SET ${setClause} WHERE id = ?`,
        [...values, id]
      );
    }
  }

  async deletePlaylist(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`DELETE FROM user_playlists WHERE id = ?`, [id]);
  }

  // Playlist item operations
  async addPlaylistItem(item: PlaylistItem): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT INTO playlist_items (id, playlist_id, surah_id, reciter_id, rewayat_id, order_index, added_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.playlistId, item.surahId, item.reciterId, item.rewayatId || null, item.orderIndex, item.addedAt]
    );
  }

  async getPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    if (!this.db) throw new Error('Database not initialized');

    const items = await this.db.getAllAsync(
      `SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY order_index ASC`,
      [playlistId]
    ) as any[];

    return items.map(item => ({
      id: item.id,
      playlistId: item.playlist_id,
      surahId: item.surah_id,
      reciterId: item.reciter_id,
      rewayatId: item.rewayat_id,
      orderIndex: item.order_index,
      addedAt: item.added_at,
    }));
  }

  async removePlaylistItem(itemId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`DELETE FROM playlist_items WHERE id = ?`, [itemId]);
  }

  async reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Update order_index for each item
    for (let i = 0; i < itemIds.length; i++) {
      await this.db.runAsync(
        `UPDATE playlist_items SET order_index = ? WHERE id = ? AND playlist_id = ?`,
        [i, itemIds[i]!, playlistId]
      );
    }
  }

  // Get next order index for a playlist
  async getNextOrderIndex(playlistId: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync(
      `SELECT MAX(order_index) as max_order FROM playlist_items WHERE playlist_id = ?`,
      [playlistId]
    ) as any;

    return (result?.max_order ?? -1) + 1;
  }

  // Close database
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
