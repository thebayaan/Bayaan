import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Track} from '@/types/audio';
import {DownloadManager} from '@/services/download/DownloadManager';
import {
  DownloadItem,
  DownloadQueueItem,
  DownloadSettings,
  DownloadOptions,
  StorageInfo,
  DownloadProgress,
} from '@/services/download/types';

interface DownloadState {
  // State
  downloads: Record<string, DownloadItem>;
  queue: DownloadQueueItem[];
  settings: DownloadSettings;
  storageInfo: StorageInfo | null;
  isInitialized: boolean;
  
  // UI State
  showDownloadProgress: boolean;
  selectedDownloads: string[];
  
  // Actions
  initialize: () => Promise<void>;
  addToDownloadQueue: (tracks: Track[], options?: Partial<DownloadOptions>) => Promise<void>;
  removeFromQueue: (trackId: string) => Promise<void>;
  pauseDownload: (trackId: string) => Promise<void>;
  resumeDownload: (trackId: string) => Promise<void>;
  deleteDownload: (trackId: string) => Promise<void>;
  updateSettings: (settings: Partial<DownloadSettings>) => Promise<void>;
  refreshStorageInfo: () => Promise<void>;
  getDownloadProgress: (trackId: string) => DownloadProgress | null;
  isTrackDownloaded: (trackId: string) => Promise<boolean>;
  getLocalPath: (trackId: string) => Promise<string | null>;
  
  // Bulk operations
  downloadReciter: (reciterId: string, rewayatId?: string) => Promise<void>;
  downloadSurah: (surahId: string, reciterIds?: string[]) => Promise<void>;
  deleteSelectedDownloads: () => Promise<void>;
  
  // UI Actions
  setShowDownloadProgress: (show: boolean) => void;
  toggleDownloadSelection: (trackId: string) => void;
  clearDownloadSelection: () => void;
  selectAllDownloads: () => void;
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => {
      const downloadManager = DownloadManager.getInstance();
      
      // Setup event listeners
      const setupEventListeners = () => {
        downloadManager.on('download_started', (data) => {
          const {trackId} = data;
          set(state => ({
            downloads: {
              ...state.downloads,
              [trackId]: {
                ...state.downloads[trackId],
                status: 'downloading',
                progress: 0,
              },
            },
          }));
        });

        downloadManager.on('download_progress', (data) => {
          const {trackId, progress, downloadedBytes, totalBytes} = data;
          set(state => ({
            downloads: {
              ...state.downloads,
              [trackId]: {
                ...state.downloads[trackId],
                progress,
                downloadedBytes,
                totalBytes,
              },
            },
          }));
        });

        downloadManager.on('download_completed', (data) => {
          const {trackId, localPath} = data;
          set(state => ({
            downloads: {
              ...state.downloads,
              [trackId]: {
                ...state.downloads[trackId],
                status: 'completed',
                progress: 100,
                localPath,
                downloadDate: new Date(),
              },
            },
            queue: state.queue.filter(item => item.track.id !== trackId),
          }));
        });

        downloadManager.on('download_failed', (data) => {
          const {trackId, error} = data;
          set(state => ({
            downloads: {
              ...state.downloads,
              [trackId]: {
                ...state.downloads[trackId],
                status: 'failed',
                error,
              },
            },
          }));
        });

        downloadManager.on('download_paused', (data) => {
          const {trackId} = data;
          set(state => ({
            downloads: {
              ...state.downloads,
              [trackId]: {
                ...state.downloads[trackId],
                status: 'paused',
              },
            },
          }));
        });

        downloadManager.on('download_resumed', (data) => {
          const {trackId} = data;
          set(state => ({
            downloads: {
              ...state.downloads,
              [trackId]: {
                ...state.downloads[trackId],
                status: 'queued',
              },
            },
          }));
        });

        downloadManager.on('queue_updated', (data) => {
          const {queue} = data;
          set({queue});
        });

        downloadManager.on('storage_warning', () => {
          // Handle storage warning
          console.warn('Storage space is running low');
        });

        downloadManager.on('storage_full', () => {
          // Handle storage full
          console.error('Storage is full, downloads paused');
        });
      };

      return {
        // Initial state
        downloads: {},
        queue: [],
        settings: {
          wifiOnly: true,
          maxConcurrentDownloads: 3,
          autoCleanup: true,
          maxStorageUsage: 80,
          downloadQuality: '192',
          autoDownloadFavorites: false,
          backgroundDownloads: true,
        },
        storageInfo: null,
        isInitialized: false,
        showDownloadProgress: false,
        selectedDownloads: [],

        // Actions
        initialize: async () => {
          try {
            await downloadManager.initialize();
            setupEventListeners();
            
            // Load initial data
            const [downloads, storageInfo] = await Promise.all([
              downloadManager.getAllDownloads(),
              downloadManager.getStorageInfo(),
            ]);

            const downloadsMap = downloads.reduce((acc, download) => {
              acc[download.trackId] = download;
              return acc;
            }, {} as Record<string, DownloadItem>);

            set({
              downloads: downloadsMap,
              storageInfo,
              isInitialized: true,
            });
          } catch (error) {
            console.error('Failed to initialize download store:', error);
          }
        },

        addToDownloadQueue: async (tracks: Track[], options?: Partial<DownloadOptions>) => {
          try {
            await downloadManager.addToDownloadQueue(tracks, options);
            
            // Update local state optimistically
            const newDownloads = {...get().downloads};
            tracks.forEach(track => {
              if (!newDownloads[track.id]) {
                newDownloads[track.id] = {
                  id: `download_${track.id}_${Date.now()}`,
                  trackId: track.id,
                  track,
                  status: 'queued',
                  progress: 0,
                  downloadedBytes: 0,
                  totalBytes: 0,
                  retryCount: 0,
                  priority: 'normal',
                };
              }
            });
            
            set({downloads: newDownloads});
          } catch (error) {
            console.error('Failed to add to download queue:', error);
          }
        },

        removeFromQueue: async (trackId: string) => {
          try {
            await downloadManager.removeFromQueue(trackId);
            
            set(state => ({
              downloads: {
                ...state.downloads,
                [trackId]: {
                  ...state.downloads[trackId],
                  status: 'cancelled' as any,
                },
              },
              queue: state.queue.filter(item => item.track.id !== trackId),
            }));
          } catch (error) {
            console.error('Failed to remove from queue:', error);
          }
        },

        pauseDownload: async (trackId: string) => {
          try {
            await downloadManager.pauseDownload(trackId);
          } catch (error) {
            console.error('Failed to pause download:', error);
          }
        },

        resumeDownload: async (trackId: string) => {
          try {
            await downloadManager.resumeDownload(trackId);
          } catch (error) {
            console.error('Failed to resume download:', error);
          }
        },

        deleteDownload: async (trackId: string) => {
          try {
            await downloadManager.deleteDownload(trackId);
            
            set(state => {
              const newDownloads = {...state.downloads};
              delete newDownloads[trackId];
              return {
                downloads: newDownloads,
                selectedDownloads: state.selectedDownloads.filter(id => id !== trackId),
              };
            });
          } catch (error) {
            console.error('Failed to delete download:', error);
          }
        },

        updateSettings: async (newSettings: Partial<DownloadSettings>) => {
          try {
            await downloadManager.updateSettings(newSettings);
            
            set(state => ({
              settings: {...state.settings, ...newSettings},
            }));
          } catch (error) {
            console.error('Failed to update settings:', error);
          }
        },

        refreshStorageInfo: async () => {
          try {
            const storageInfo = await downloadManager.getStorageInfo();
            set({storageInfo});
          } catch (error) {
            console.error('Failed to refresh storage info:', error);
          }
        },

        getDownloadProgress: (trackId: string) => {
          return downloadManager.getDownloadProgress(trackId);
        },

        isTrackDownloaded: async (trackId: string) => {
          return await downloadManager.isTrackDownloaded(trackId);
        },

        getLocalPath: async (trackId: string) => {
          return await downloadManager.getLocalPath(trackId);
        },

        // Bulk operations
        downloadReciter: async (reciterId: string, rewayatId?: string) => {
          try {
            await downloadManager.downloadReciter(reciterId, rewayatId);
          } catch (error) {
            console.error('Failed to download reciter:', error);
          }
        },

        downloadSurah: async (surahId: string, reciterIds?: string[]) => {
          try {
            await downloadManager.downloadSurah(surahId, reciterIds);
          } catch (error) {
            console.error('Failed to download surah:', error);
          }
        },

        deleteSelectedDownloads: async () => {
          const {selectedDownloads} = get();
          
          try {
            await Promise.all(
              selectedDownloads.map(trackId => downloadManager.deleteDownload(trackId))
            );
            
            set(state => {
              const newDownloads = {...state.downloads};
              selectedDownloads.forEach(trackId => {
                delete newDownloads[trackId];
              });
              
              return {
                downloads: newDownloads,
                selectedDownloads: [],
              };
            });
          } catch (error) {
            console.error('Failed to delete selected downloads:', error);
          }
        },

        // UI Actions
        setShowDownloadProgress: (show: boolean) => {
          set({showDownloadProgress: show});
        },

        toggleDownloadSelection: (trackId: string) => {
          set(state => ({
            selectedDownloads: state.selectedDownloads.includes(trackId)
              ? state.selectedDownloads.filter(id => id !== trackId)
              : [...state.selectedDownloads, trackId],
          }));
        },

        clearDownloadSelection: () => {
          set({selectedDownloads: []});
        },

        selectAllDownloads: () => {
          const {downloads} = get();
          const allTrackIds = Object.keys(downloads).filter(
            trackId => downloads[trackId].status === 'completed'
          );
          set({selectedDownloads: allTrackIds});
        },
      };
    },
    {
      name: 'download-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
        // Don't persist downloads, queue, or other dynamic data
        // They will be loaded from the file system on initialization
      }),
    }
  )
);