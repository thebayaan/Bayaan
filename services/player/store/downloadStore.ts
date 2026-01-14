import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearAllDownloads as clearAllDownloadsService,
  removeDownload as removeDownloadService,
  extractFilename,
} from '@/services/downloadService';

// Throttle utility to prevent excessive state updates during downloads
const throttleMap = new Map<
  string,
  {timer: NodeJS.Timeout | null; lastValue: number}
>();

function throttledSetProgress(
  set: (fn: (state: DownloadStoreState) => Partial<DownloadStoreState>) => void,
  id: string,
  progress: number,
  delay = 150,
) {
  const existing = throttleMap.get(id);

  // Always update the last value
  if (existing) {
    existing.lastValue = progress;

    // If there's already a pending timer, don't create a new one
    if (existing.timer) {
      return;
    }
  } else {
    throttleMap.set(id, {timer: null, lastValue: progress});
  }

  // If progress is 1 (100%), update immediately and clear throttle
  if (progress >= 1) {
    set(state => ({
      downloadProgress: {
        ...state.downloadProgress,
        [id]: progress,
      },
    }));
    throttleMap.delete(id);
    return;
  }

  // Set up the throttled update
  const entry = throttleMap.get(id);
  if (!entry) return;

  entry.timer = setTimeout(() => {
    const currentEntry = throttleMap.get(id);
    if (currentEntry) {
      set(state => ({
        downloadProgress: {
          ...state.downloadProgress,
          [id]: currentEntry.lastValue,
        },
      }));
      currentEntry.timer = null;
    }
  }, delay);
}

export interface DownloadedSurah {
  reciterId: string;
  surahId: string;
  rewayatId: string;
  filePath: string; // Where the file is saved
  fileSize: number; // Size in bytes
  downloadDate: number; // When downloaded
  status: 'downloading' | 'completed' | 'error';
}

interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  trackIds: string[]; // Array of "reciterId:surahId:rewayatId" strings
}

interface PlaylistDownloadProgress {
  current: number;
  total: number;
  percentage: number;
}

interface DownloadStoreState {
  // State
  downloads: DownloadedSurah[];
  downloading: string[]; // IDs currently downloading: ["abdul_basit-1", "abdul_basit-2"]
  downloadProgress: Record<string, number>; // Progress map: {"abdul_basit-1": 0.5}
  playlistDownloads: Record<string, PlaylistDownloadProgress>; // Playlist download progress
  error: Error | null;

  // Actions
  addDownload: (download: DownloadedSurah) => void;
  removeDownload: (
    reciterId: string,
    surahId: string,
    rewayatId?: string,
  ) => void;
  clearDownloads: () => void;

  // Queries (these are the missing pieces!)
  isDownloaded: (reciterId: string, surahId: string) => boolean;
  isDownloadedWithRewayat: (
    reciterId: string,
    surahId: string,
    rewayatId: string,
  ) => boolean;
  isDownloading: (reciterId: string, surahId: string) => boolean;
  isDownloadingWithRewayat: (
    reciterId: string,
    surahId: string,
    rewayatId: string,
  ) => boolean;
  getDownload: (
    reciterId: string,
    surahId: string,
  ) => DownloadedSurah | undefined;
  setDownloads: (downloads: DownloadedSurah[]) => void;
  clearAllDownloads: () => Promise<void>;
  // Status management
  setDownloading: (id: string) => void;
  clearDownloading: (id: string) => void;
  setDownloadProgress: (id: string, progress: number) => void;
  getDownloadProgress: (
    reciterId: string,
    surahId: string,
    rewayatId?: string,
  ) => number;
  reorderDownloads: (fromIndex: number, toIndex: number) => void;
  setError: (error: Error | null) => void;

  // Playlist download management
  setPlaylistDownloadProgress: (
    playlistId: string,
    progress: PlaylistDownloadProgress | null,
  ) => void;
  getPlaylistDownloadProgress: (
    playlistId: string,
  ) => PlaylistDownloadProgress | null;
  isPlaylistDownloading: (playlistId: string) => boolean;

  // Playlists
  playlists: Playlist[];
  createPlaylist: (name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  addToPlaylist: (playlistId: string, trackId: string) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
}

// Add this after your interface (around line 39)
const STORAGE_KEY = 'downloads-store';

export const useDownloadStore = create<DownloadStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      downloads: [],
      downloading: [],
      downloadProgress: {},
      playlistDownloads: {},
      error: null,
      playlists: [],

      createPlaylist: (name: string) => {
        const newPlaylist: Playlist = {
          id: Date.now().toString(), // Simple ID generation
          name,
          createdAt: Date.now(),
          trackIds: [],
        };

        set(state => ({
          playlists: [...state.playlists, newPlaylist],
        }));
      },

      deletePlaylist: (playlistId: string) => {
        set(state => ({
          playlists: state.playlists.filter(p => p.id !== playlistId),
        }));
      },

      addToPlaylist: (playlistId: string, trackId: string) => {
        set(state => ({
          playlists: state.playlists.map(playlist =>
            playlist.id === playlistId
              ? {...playlist, trackIds: [...playlist.trackIds, trackId]}
              : playlist,
          ),
        }));
      },

      removeFromPlaylist: (playlistId: string, trackId: string) => {
        set(state => ({
          playlists: state.playlists.map(playlist =>
            playlist.id === playlistId
              ? {
                  ...playlist,
                  trackIds: playlist.trackIds.filter(id => id !== trackId),
                }
              : playlist,
          ),
        }));
      },

      // Actions
      addDownload: (download: DownloadedSurah) => {
        set(state => {
          // Check if download already exists (must match reciterId, surahId, AND rewayatId)
          const exists = state.downloads.some(
            d =>
              d.reciterId === download.reciterId &&
              d.surahId === download.surahId &&
              (d.rewayatId || '') === (download.rewayatId || ''),
          );

          if (exists) {
            console.log('Download already exists, skipping duplicate');
            return state; // Don't add duplicate
          }

          return {
            downloads: [...state.downloads, download],
          };
        });
      },
      removeDownload: async (
        reciterId: string,
        surahId: string,
        rewayatId?: string,
      ) => {
        const {downloads} = get();
        const download = downloads.find(d => {
          const reciterMatch = d.reciterId === reciterId;
          const surahMatch = d.surahId === surahId;

          // If rewayatId is provided, match it exactly
          if (rewayatId) {
            return reciterMatch && surahMatch && d.rewayatId === rewayatId;
          }

          // If rewayatId is not provided, only match downloads without rewayatId
          return (
            reciterMatch && surahMatch && (!d.rewayatId || d.rewayatId === '')
          );
        });

        try {
          if (download) {
            await removeDownloadService(download);
          }

          // Remove from store
          set(state => ({
            downloads: state.downloads.filter(d => {
              const reciterMatch = d.reciterId === reciterId;
              const surahMatch = d.surahId === surahId;

              // If rewayatId is provided, only remove that specific one
              if (rewayatId) {
                return !(
                  reciterMatch &&
                  surahMatch &&
                  d.rewayatId === rewayatId
                );
              }

              // If rewayatId is not provided, only remove downloads without rewayatId
              return !(
                reciterMatch &&
                surahMatch &&
                (!d.rewayatId || d.rewayatId === '')
              );
            }),
          }));
        } catch (error) {
          console.error('Error removing download:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error occurred';
          set({error: new Error(`Failed to remove download: ${errorMessage}`)});
          throw error;
        }
      },

      clearDownloads: () => {
        set({downloads: []});
      },

      setDownloads: (downloads: DownloadedSurah[]) => {
        set({downloads});
      },
      clearAllDownloads: async () => {
        const {downloads} = get();

        try {
          // Delete files using service
          await clearAllDownloadsService(downloads);

          // Clear store - let Zustand handle persistence
          set({downloads: [], downloading: [], error: null});
        } catch (error) {
          console.error('Error clearing downloads:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error occurred';
          set({error: new Error(`Failed to clear downloads: ${errorMessage}`)});
          throw error;
        }
      },

      // Queries
      // Only matches downloads without a specific rewayatId (empty string)
      isDownloaded: (reciterId: string, surahId: string) => {
        const {downloads} = get();
        return downloads.some(
          d =>
            d.reciterId === reciterId &&
            d.surahId === surahId &&
            (!d.rewayatId || d.rewayatId === '') &&
            d.status === 'completed',
        );
      },

      isDownloadedWithRewayat: (
        reciterId: string,
        surahId: string,
        rewayatId: string,
      ) => {
        const {downloads} = get();
        return downloads.some(
          d =>
            d.reciterId === reciterId &&
            d.surahId === surahId &&
            d.rewayatId === rewayatId &&
            d.status === 'completed',
        );
      },

      // Only checks for downloads without a specific rewayatId
      isDownloading: (reciterId: string, surahId: string) => {
        const {downloading} = get();
        const id = `${reciterId}-${surahId}`;
        return downloading.includes(id);
      },

      isDownloadingWithRewayat: (
        reciterId: string,
        surahId: string,
        rewayatId: string,
      ) => {
        const {downloading} = get();
        const id = `${reciterId}-${surahId}-${rewayatId}`;
        return downloading.includes(id);
      },

      // Only gets downloads without a specific rewayatId (empty string)
      getDownload: (reciterId: string, surahId: string) => {
        const {downloads} = get();
        return downloads.find(
          d =>
            d.reciterId === reciterId &&
            d.surahId === surahId &&
            (!d.rewayatId || d.rewayatId === ''),
        );
      },

      // Status management
      setDownloading: (id: string) => {
        set(state => ({
          downloading: [...state.downloading, id],
        }));
      },

      clearDownloading: (id: string) => {
        // Clean up throttle map entry
        const throttleEntry = throttleMap.get(id);
        if (throttleEntry?.timer) {
          clearTimeout(throttleEntry.timer);
        }
        throttleMap.delete(id);

        set(state => {
          const newProgress = {...state.downloadProgress};
          delete newProgress[id];
          return {
            downloading: state.downloading.filter(d => d !== id),
            downloadProgress: newProgress,
          };
        });
      },

      setDownloadProgress: (id: string, progress: number) => {
        // Use throttled update to prevent main thread blocking
        throttledSetProgress(set, id, progress);
      },

      getDownloadProgress: (
        reciterId: string,
        surahId: string,
        rewayatId?: string,
      ) => {
        const {downloadProgress} = get();
        const id = rewayatId
          ? `${reciterId}-${surahId}-${rewayatId}`
          : `${reciterId}-${surahId}`;
        return downloadProgress[id] || 0;
      },

      reorderDownloads: (fromIndex: number, toIndex: number) => {
        set(state => {
          const newDownloads = [...state.downloads];
          const [movedItem] = newDownloads.splice(fromIndex, 1);
          newDownloads.splice(toIndex, 0, movedItem);
          return {downloads: newDownloads};
        });
      },

      setError: (error: Error | null) => {
        set({error});
      },

      // Playlist download management
      setPlaylistDownloadProgress: (
        playlistId: string,
        progress: PlaylistDownloadProgress | null,
      ) => {
        set(state => {
          if (progress === null) {
            const newPlaylistDownloads = {...state.playlistDownloads};
            delete newPlaylistDownloads[playlistId];
            return {playlistDownloads: newPlaylistDownloads};
          }
          return {
            playlistDownloads: {
              ...state.playlistDownloads,
              [playlistId]: progress,
            },
          };
        });
      },

      getPlaylistDownloadProgress: (playlistId: string) => {
        const {playlistDownloads} = get();
        return playlistDownloads[playlistId] || null;
      },

      isPlaylistDownloading: (playlistId: string) => {
        const {playlistDownloads} = get();
        return playlistDownloads[playlistId] !== undefined;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        downloads: state.downloads,
        playlists: state.playlists,
      }),
      // Migration: Convert absolute paths to relative paths (filenames only)
      // This fixes the issue where iOS changes the app container UUID on updates,
      // which would make stored absolute paths invalid
      onRehydrateStorage: () => state => {
        if (state && state.downloads.length > 0) {
          const needsMigration = state.downloads.some(
            d => d.filePath.startsWith('file://') || d.filePath.startsWith('/'),
          );

          if (needsMigration) {
            console.log(
              '[DownloadStore] Migrating absolute paths to relative paths...',
            );
            const migratedDownloads = state.downloads.map(download => ({
              ...download,
              filePath: extractFilename(download.filePath),
            }));

            // Update the store with migrated paths
            useDownloadStore.setState({downloads: migratedDownloads});
            console.log(
              `[DownloadStore] Migrated ${migratedDownloads.length} downloads`,
            );
          }
        }
      },
    },
  ),
);
