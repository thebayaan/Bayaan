import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'loved-tracks-store';

export interface LovedTrack {
  reciterId: string;
  surahId: string;
  rewayatId: string;
  timestamp: number;
}

interface LovedTracksState {
  // State
  tracks: LovedTrack[];
  loading: boolean;
  error: Error | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSynced: number | null;

  // Actions
  toggleLoved: (reciterId: string, surahId: string, rewayatId: string) => void;
  isLoved: (reciterId: string, surahId: string) => boolean;
  isLovedWithRewayat: (
    reciterId: string,
    surahId: string,
    rewayatId: string,
  ) => boolean;
  getLovedTracks: () => LovedTrack[];
  clearLoved: () => void;

  // Future sync methods
  sync: () => Promise<void>;
  setSyncStatus: (status: 'idle' | 'syncing' | 'error') => void;
  setError: (error: Error | null) => void;
}

export const useLovedStore = create<LovedTracksState>()(
  persist(
    (set, get) => ({
      // Initial state
      tracks: [],
      loading: false,
      error: null,
      syncStatus: 'idle',
      lastSynced: null,

      // Core actions
      toggleLoved: (reciterId: string, surahId: string, rewayatId: string) => {
        set(state => {
          // Check if a track exists with either the new format (with rewayatId)
          // or the old format (without rewayatId)
          const existingTrack = state.tracks.find(
            t =>
              (t.reciterId === reciterId &&
                t.surahId === surahId &&
                t.rewayatId === rewayatId) ||
              (t.reciterId === reciterId &&
                t.surahId === surahId &&
                !t.rewayatId),
          );

          let newTracks: LovedTrack[];
          if (existingTrack) {
            // Remove if exists
            newTracks = state.tracks.filter(t => t !== existingTrack);
          } else {
            // Add to the beginning so most recent is first
            newTracks = [
              {reciterId, surahId, rewayatId, timestamp: Date.now()},
              ...state.tracks,
            ];
          }

          return {tracks: newTracks};
        });
      },

      isLoved: (reciterId: string, surahId: string) => {
        const {tracks} = get();
        return tracks.some(
          t => t.reciterId === reciterId && t.surahId === surahId,
        );
      },

      isLovedWithRewayat: (
        reciterId: string,
        surahId: string,
        rewayatId: string,
      ) => {
        const {tracks} = get();

        // Check for exact match with rewayatId
        const hasExactMatch = tracks.some(
          track =>
            track.reciterId === reciterId &&
            track.surahId === surahId &&
            track.rewayatId === rewayatId,
        );

        if (hasExactMatch) {
          return true;
        }

        // If no exact match, check for old format without rewayatId
        const hasOldFormatMatch = tracks.some(
          track =>
            track.reciterId === reciterId &&
            track.surahId === surahId &&
            !track.rewayatId,
        );

        return hasOldFormatMatch;
      },

      getLovedTracks: () => {
        // Return tracks sorted by timestamp descending (most recent first)
        return [...get().tracks].sort((a, b) => b.timestamp - a.timestamp);
      },

      clearLoved: () => {
        set({tracks: []});
      },

      // Future sync methods (placeholders for now)
      sync: async () => {
        const state = get();
        if (state.syncStatus === 'syncing') return;

        try {
          set({syncStatus: 'syncing'});
          // Sync logic with backend pending implementation
          set({
            syncStatus: 'idle',
            lastSynced: Date.now(),
            error: null,
          });
        } catch (error) {
          set({
            syncStatus: 'error',
            error: error instanceof Error ? error : new Error('Sync failed'),
          });
        }
      },

      setSyncStatus: (status: 'idle' | 'syncing' | 'error') => {
        set({syncStatus: status});
      },

      setError: (error: Error | null) => {
        set({error});
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        tracks: state.tracks,
        lastSynced: state.lastSynced,
      }),
    },
  ),
);

// Hook for easy access to loved track functionality
export const useLoved = () => {
  const store = useLovedStore();
  return {
    // State - return tracks sorted by timestamp descending (most recent first)
    lovedTracks: [...store.tracks].sort((a, b) => b.timestamp - a.timestamp),
    loading: store.loading,
    error: store.error,
    syncStatus: store.syncStatus,
    lastSynced: store.lastSynced,

    // Actions
    toggleLoved: store.toggleLoved,
    isLoved: store.isLoved,
    isLovedWithRewayat: store.isLovedWithRewayat,
    getLovedTracks: store.getLovedTracks,
    clearLoved: store.clearLoved,
    sync: store.sync,
  };
};

// Export singleton instance
export const lovedStore = useLovedStore;
