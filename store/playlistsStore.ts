import {create} from 'zustand';
import {
  playlistService,
  UserPlaylist,
  PlaylistItem,
} from '@/services/playlist/PlaylistService';

interface PlaylistsState {
  // State
  playlists: UserPlaylist[];
  loading: boolean;
  error: string | null;
  isLoading: boolean; // Internal flag to prevent concurrent loads

  // Actions
  loadPlaylists: () => Promise<void>;
  createPlaylist: (
    name: string,
    color: string,
    description?: string,
  ) => Promise<UserPlaylist>;
  updatePlaylist: (
    id: string,
    updates: Partial<UserPlaylist>,
  ) => Promise<UserPlaylist | null>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  getPlaylist: (id: string) => Promise<UserPlaylist | null>;
  getPlaylistItems: (playlistId: string) => Promise<PlaylistItem[]>;
  addToPlaylist: (
    playlistId: string,
    surahId: string,
    reciterId: string,
    rewayatId?: string,
  ) => Promise<void>;
  removeFromPlaylist: (itemId: string) => Promise<void>;
  reorderPlaylistItems: (
    playlistId: string,
    itemIds: string[],
  ) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
}

export const usePlaylistsStore = create<PlaylistsState>((set, get) => ({
  // Initial state
  playlists: [],
  loading: true, // Start as loading to indicate we haven't loaded yet
  error: null,
  isLoading: false, // Internal flag to prevent concurrent loads

  // Load playlists from database
  loadPlaylists: async () => {
    // Prevent concurrent loads
    if (get().isLoading) {
      return;
    }

    try {
      set({loading: true, error: null, isLoading: true});
      const allPlaylists = await playlistService.getAllPlaylists();
      // Force new array and object references to ensure Zustand notifies subscribers
      const newPlaylists = allPlaylists.map(p => ({...p}));
      set({playlists: newPlaylists, loading: false, isLoading: false});
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load playlists';
      set({error: errorMessage, loading: false, isLoading: false});
    }
  },

  // Create a new playlist
  createPlaylist: async (name: string, color: string, description?: string) => {
    try {
      set({error: null});
      const newPlaylist = await playlistService.createPlaylist(
        name,
        color,
        description,
      );
      // Small delay to ensure transaction is fully committed
      await new Promise(resolve => setTimeout(resolve, 50));
      // Refresh the list to get updated item counts
      await get().loadPlaylists();
      return newPlaylist;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create playlist';
      set({error: errorMessage});
      throw err;
    }
  },

  // Update an existing playlist
  updatePlaylist: async (id: string, updates: Partial<UserPlaylist>) => {
    try {
      set({error: null});
      const updatedPlaylist = await playlistService.updatePlaylist(id, updates);
      if (updatedPlaylist) {
        // Immediately update the playlist in the store for instant UI feedback
        set(state => ({
          playlists: state.playlists.map(p =>
            p.id === id ? {...p, ...updates, updatedAt: Date.now()} : {...p},
          ),
        }));

        // Small delay to ensure transaction is fully committed
        await new Promise(resolve => setTimeout(resolve, 50));
        // Then refresh to get accurate data from database
        await get().loadPlaylists();
        return updatedPlaylist;
      }
      throw new Error('Playlist not found');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update playlist';
      set({error: errorMessage});
      // Reload to sync with database on error
      await get().loadPlaylists();
      throw err;
    }
  },

  // Delete a playlist
  deletePlaylist: async (playlistId: string) => {
    try {
      set({error: null});
      await playlistService.deletePlaylist(playlistId);
      // Small delay to ensure transaction is fully committed
      await new Promise(resolve => setTimeout(resolve, 50));
      // Refresh the list to remove deleted playlist
      await get().loadPlaylists();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete playlist';
      set({error: errorMessage});
      throw err;
    }
  },

  // Get a single playlist (doesn't update state, just fetches)
  getPlaylist: async (id: string) => {
    try {
      set({error: null});
      return await playlistService.getPlaylist(id);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to get playlist';
      set({error: errorMessage});
      throw err;
    }
  },

  // Get playlist items (doesn't update state, just fetches)
  getPlaylistItems: async (playlistId: string) => {
    try {
      set({error: null});
      return await playlistService.getPlaylistItems(playlistId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to get playlist items';
      set({error: errorMessage});
      throw err;
    }
  },

  // Add item to playlist
  addToPlaylist: async (
    playlistId: string,
    surahId: string,
    reciterId: string,
    rewayatId?: string,
  ) => {
    try {
      set({error: null});
      await playlistService.addToPlaylist(
        playlistId,
        surahId,
        reciterId,
        rewayatId,
      );
      // Refresh to update item counts
      await get().loadPlaylists();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to add item to playlist';
      set({error: errorMessage});
      throw err;
    }
  },

  // Remove item from playlist
  removeFromPlaylist: async (itemId: string) => {
    try {
      set({error: null});
      await playlistService.removeFromPlaylist(itemId);
      // Refresh to update item counts
      await get().loadPlaylists();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to remove item from playlist';
      set({error: errorMessage});
      throw err;
    }
  },

  // Reorder playlist items
  reorderPlaylistItems: async (playlistId: string, itemIds: string[]) => {
    try {
      set({error: null});
      await playlistService.reorderPlaylistItems(playlistId, itemIds);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to reorder playlist items';
      set({error: errorMessage});
      throw err;
    }
  },

  // Alias for loadPlaylists for consistency
  refreshPlaylists: async () => {
    await get().loadPlaylists();
  },
}));
