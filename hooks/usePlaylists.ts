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
    refreshPlaylists: loadPlaylists,
  };
};
