import {useState, useEffect} from 'react';
import {playlistService, UserPlaylist} from '@/services/playlist/PlaylistService';

export const usePlaylists = () => {
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load playlists
  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);
      const allPlaylists = await playlistService.getAllPlaylists();
      setPlaylists(allPlaylists);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  // Create playlist
  const createPlaylist = async (name: string, color: string, description?: string) => {
    try {
      setError(null);
      const newPlaylist = await playlistService.createPlaylist(name, color, description);
      await loadPlaylists(); // Refresh the list
      return newPlaylist;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playlist');
      throw err;
    }
  };

  // Delete playlist
  const deletePlaylist = async (playlistId: string) => {
    try {
      setError(null);
      await playlistService.deletePlaylist(playlistId);
      await loadPlaylists(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete playlist');
      throw err;
    }
  };

  // Update playlist
  const updatePlaylist = async (id: string, updates: Partial<UserPlaylist>) => {
    try {
      setError(null);
      const updatedPlaylist = await playlistService.updatePlaylist(id, updates);
      if (updatedPlaylist) {
        await loadPlaylists(); // Refresh the list
        return updatedPlaylist;
      }
      throw new Error('Playlist not found');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update playlist');
      throw err;
    }
  };

  // Get single playlist
  const getPlaylist = async (id: string) => {
    try {
      setError(null);
      return await playlistService.getPlaylist(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get playlist');
      throw err;
    }
  };

  // Get playlist items
  const getPlaylistItems = async (playlistId: string) => {
    try {
      setError(null);
      return await playlistService.getPlaylistItems(playlistId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get playlist items');
      throw err;
    }
  };

  // Remove item from playlist
  const removeFromPlaylist = async (itemId: string) => {
    try {
      setError(null);
      await playlistService.removeFromPlaylist(itemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item from playlist');
      throw err;
    }
  };

  // Reorder playlist items
  const reorderPlaylistItems = async (playlistId: string, itemIds: string[]) => {
    try {
      setError(null);
      await playlistService.reorderPlaylistItems(playlistId, itemIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder playlist items');
      throw err;
    }
  };

  // Load playlists on mount
  useEffect(() => {
    loadPlaylists();
  }, []);

  return {
    playlists,
    loading,
    error,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    getPlaylist,
    getPlaylistItems,
    removeFromPlaylist,
    reorderPlaylistItems,
    refreshPlaylists: loadPlaylists,
  };
};
