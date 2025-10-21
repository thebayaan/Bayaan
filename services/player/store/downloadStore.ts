import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { clearAllDownloads } from '@/services/downloadService';



export interface DownloadedSurah {
    reciterId: string;
    surahId: string;
    rewayatId: string;
    filePath: string;        // Where the file is saved
    fileSize: number;       // Size in bytes
    downloadDate: number;   // When downloaded
    status: 'downloading' | 'completed' | 'error';
  }

  interface DownloadStoreState {
    // State
    downloads: DownloadedSurah[];
    downloading: string[]; // IDs currently downloading: ["abdul_basit-1", "abdul_basit-2"]
    error: Error | null;
    
    // Actions
    addDownload: (download: DownloadedSurah) => void;
    removeDownload: (reciterId: string, surahId: string) => void;
    clearDownloads: () => void;
    
    // Queries (these are the missing pieces!)
    isDownloaded: (reciterId: string, surahId: string) => boolean;
    isDownloading: (reciterId: string, surahId: string) => boolean;
    getDownload: (reciterId: string, surahId: string) => DownloadedSurah | undefined;
    clearAllDownloads: () => Promise<void>;
    // Status management
    setDownloading: (id: string) => void;
    clearDownloading: (id: string) => void;
    setError: (error: Error | null) => void;
  }

// Add this after your interface (around line 39)
const STORAGE_KEY = 'downloads-store';

export const useDownloadStore = create<DownloadStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      downloads: [],
      downloading: [],
      error: null,

      // Actions
      addDownload: (download: DownloadedSurah) => {
        set(state => {
          // Check if download already exists
          const exists = state.downloads.some(d => 
            d.reciterId === download.reciterId && 
            d.surahId === download.surahId
          );
          
          if (exists) {
            console.log('Download already exists, skipping duplicate');
            return state; // Don't add duplicate
          }
          
          return {
            downloads: [...state.downloads, download]
          };
        });
      },
      removeDownload: (reciterId: string, surahId: string) => {
        set(state => ({
          downloads: state.downloads.filter(d => 
            !(d.reciterId === reciterId && d.surahId === surahId)
          )
        }));
      },

      clearDownloads: () => {
        set({downloads: []});
      },

      clearAllDownloads: async () => {
        const {downloads} = get();
        
        // Delete files using service
        await clearAllDownloads(downloads);
        
        // Clear store
        set({downloads: []});
      },

      // Queries
      isDownloaded: (reciterId: string, surahId: string) => {
        const {downloads} = get();
        return downloads.some(d => 
          d.reciterId === reciterId && 
          d.surahId === surahId && 
          d.status === 'completed'
        );
      },

      isDownloading: (reciterId: string, surahId: string) => {
        const {downloading} = get();
        const id = `${reciterId}-${surahId}`;
        return downloading.includes(id);
      },

      getDownload: (reciterId: string, surahId: string) => {
        const {downloads} = get();
        return downloads.find(d => 
          d.reciterId === reciterId && d.surahId === surahId
        );
      },

      // Status management
      setDownloading: (id: string) => {
        set(state => ({
          downloading: [...state.downloading, id]
        }));
      },

      clearDownloading: (id: string) => {
        set(state => ({
          downloading: state.downloading.filter(d => d !== id)
        }));
      },

      setError: (error: Error | null) => {
        set({error});
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        downloads: state.downloads,
      }),
    },
  ),
);

export const useDownload = () => {
    const store = useDownloadStore();
    return {
      downloads: store.downloads,
      downloading: store.downloading,
      error: store.error,
      addDownload: store.addDownload,
      removeDownload: store.removeDownload,
      clearDownloads: store.clearDownloads,
      isDownloaded: store.isDownloaded,
      isDownloading: store.isDownloading,
      getDownload: store.getDownload,
      setDownloading: store.setDownloading,
      clearDownloading: store.clearDownloading,
      clearAllDownloads: store.clearAllDownloads,
      setError: store.setError,
    };
  };