import {useEffect} from 'react';
import {usePlaylistsStore} from '@/store/playlistsStore';

/**
 * Hook to access and manage playlists.
 * This hook wraps the Zustand store to provide a consistent API
 * while ensuring all components share the same state.
 *
 * The store acts as a single source of truth, so updates from one
 * component automatically propagate to all other components using this hook.
 */
export const usePlaylists = () => {
  // Get state and actions from the Zustand store
  const playlists = usePlaylistsStore(state => state.playlists);
  const loading = usePlaylistsStore(state => state.loading);
  const error = usePlaylistsStore(state => state.error);
  const loadPlaylists = usePlaylistsStore(state => state.loadPlaylists);
  const createPlaylist = usePlaylistsStore(state => state.createPlaylist);
  const updatePlaylist = usePlaylistsStore(state => state.updatePlaylist);
  const deletePlaylist = usePlaylistsStore(state => state.deletePlaylist);
  const getPlaylist = usePlaylistsStore(state => state.getPlaylist);
  const getPlaylistItems = usePlaylistsStore(state => state.getPlaylistItems);
  const addToPlaylist = usePlaylistsStore(state => state.addToPlaylist);
  const removeFromPlaylist = usePlaylistsStore(
    state => state.removeFromPlaylist,
  );
  const reorderPlaylistItems = usePlaylistsStore(
    state => state.reorderPlaylistItems,
  );
  const refreshPlaylists = usePlaylistsStore(state => state.refreshPlaylists);

  // Safety fallback: Load playlists if not already loaded by AppInitializer
  // This should rarely execute as AppInitializer preloads data on app startup
  useEffect(() => {
    // Only load if we have no playlists and we're not currently loading
    if (playlists.length === 0 && !loading) {
      console.warn(
        '[usePlaylists] Playlists not preloaded, loading as fallback...',
      );
      loadPlaylists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount

  return {
    playlists,
    loading,
    error,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    getPlaylist,
    getPlaylistItems,
    addToPlaylist,
    removeFromPlaylist,
    reorderPlaylistItems,
    refreshPlaylists,
  };
};
