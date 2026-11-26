import {useMemo} from 'react'; // @ai
import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage'; // @ai
import {analyticsService} from '@/services/analytics/AnalyticsService';

const STORAGE_KEY = 'loved-tracks-store';

export interface LovedTrack {
  reciterId: string;
  surahId: string;
  rewayatId: string;
  timestamp: number;
  userRecitationId?: string;
}

// @ai-start
/**
 * Does a saved entry stand for the recitation being asked about?
 *
 * An upload is asked about by its own id and is only ever itself, whatever
 * reciter and surah it is tagged with. A catalogue recitation matches the
 * entry saved for its rewayah, or an "old format" entry saved without one.
 * Uploads are saved without a rewayah too, so that old-format rule has to
 * skip them: it made an upload and the catalogue recording of the same
 * reciter and surah share one heart, and unloving one removed the other.
 *
 * Asked with no rewayah and no upload id (rows that know neither), any entry
 * saved without a rewayah still matches, as before.
 */
function isSameLovedRecitation(
  saved: LovedTrack,
  reciterId: string,
  surahId: string,
  rewayatId: string,
  userRecitationId?: string,
): boolean {
  if (userRecitationId) return saved.userRecitationId === userRecitationId;
  if (saved.reciterId !== reciterId || saved.surahId !== surahId) return false;
  if (!rewayatId) return !saved.rewayatId;
  if (saved.userRecitationId) return false;
  return saved.rewayatId === rewayatId || !saved.rewayatId;
}
// @ai-end

interface LovedTracksState {
  // State
  tracks: LovedTrack[];
  loading: boolean;
  error: Error | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSynced: number | null;

  // Actions
  toggleLoved: (
    reciterId: string,
    surahId: string,
    rewayatId: string,
    userRecitationId?: string,
  ) => void;
  isLoved: (reciterId: string, surahId: string) => boolean;
  isLovedWithRewayat: (
    reciterId: string,
    surahId: string,
    rewayatId: string,
    userRecitationId?: string, // @ai
  ) => boolean;
  getLovedTracks: () => LovedTrack[];
  clearLoved: () => void;
  /** Drops the entries of uploads that no longer exist. @ai */
  removeUploads: (userRecitationIds: readonly string[]) => void; // @ai

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
      toggleLoved: (
        reciterId: string,
        surahId: string,
        rewayatId: string,
        userRecitationId?: string,
      ) => {
        // Determine current loved state before toggling
        // @ai-start
        const isCurrentlyLoved = get().tracks.some(t =>
          isSameLovedRecitation(
            t,
            reciterId,
            surahId,
            rewayatId,
            userRecitationId,
          ),
        );
        // @ai-end

        analyticsService.trackFavoriteToggled({
          surah_id: parseInt(surahId ?? '0', 10),
          reciter_id: reciterId,
          action: isCurrentlyLoved ? 'remove' : 'add',
        });

        set(state => {
          // Check if a track exists with either the new format (with rewayatId)
          // or the old format (without rewayatId)
          // @ai-start
          const existingTrack = state.tracks.find(t =>
            isSameLovedRecitation(
              t,
              reciterId,
              surahId,
              rewayatId,
              userRecitationId,
            ),
          );
          // @ai-end

          let newTracks: LovedTrack[];
          if (existingTrack) {
            // Remove if exists
            newTracks = state.tracks.filter(t => t !== existingTrack);
          } else {
            // Add to the beginning so most recent is first
            newTracks = [
              {
                reciterId,
                surahId,
                rewayatId,
                timestamp: Date.now(),
                userRecitationId,
              },
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
        userRecitationId?: string, // @ai
      ) => {
        const {tracks} = get();

        // @ai-start
        // The entry for this rewayah, or an old-format entry saved without
        // one; an upload only by its own id (see isSameLovedRecitation).
        return tracks.some(track =>
          isSameLovedRecitation(
            track,
            reciterId,
            surahId,
            rewayatId,
            userRecitationId,
          ),
        );
        // @ai-end
      },

      getLovedTracks: () => {
        // Return tracks sorted by timestamp descending (most recent first)
        return [...get().tracks].sort((a, b) => b.timestamp - a.timestamp);
      },

      clearLoved: () => {
        set({tracks: []});
      },

      // @ai-start
      removeUploads: (userRecitationIds: readonly string[]) => {
        const gone = new Set(userRecitationIds);
        set(state => {
          const tracks = state.tracks.filter(
            t => !t.userRecitationId || !gone.has(t.userRecitationId),
          );
          return tracks.length === state.tracks.length ? state : {tracks};
        });
      },
      // @ai-end

      // Future sync methods (placeholders for now)
      sync: async () => {
        const state = get();
        if (state.syncStatus === 'syncing') return;

        try {
          set({syncStatus: 'syncing'});
          // TODO: Implement sync with backend
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
      storage: persistStorage(), // @ai
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
  // @ai-start
  // Sorted once per change to the saved tracks. A new array on every render
  // could not be used as a memo dependency, which is why the Loved screen
  // had to reload itself asynchronously.
  const lovedTracks = useMemo(
    () => [...store.tracks].sort((a, b) => b.timestamp - a.timestamp),
    [store.tracks],
  );
  // @ai-end
  return {
    // State - return tracks sorted by timestamp descending (most recent first)
    lovedTracks, // @ai
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
