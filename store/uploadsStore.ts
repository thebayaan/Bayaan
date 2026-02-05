import {create} from 'zustand';
import {uploadsService} from '@/services/uploads/UploadsService';
import type {UploadedRecitation, CustomReciter} from '@/types/uploads';

interface UploadsState {
  // State
  recitations: UploadedRecitation[];
  customReciters: CustomReciter[];
  loading: boolean;
  error: string | null;
  isLoading: boolean;
  totalCount: number;

  // Actions
  loadRecitations: () => Promise<void>;
  importFile: (
    sourceUri: string,
    originalFilename: string,
  ) => Promise<UploadedRecitation>;
  importFiles: (
    files: Array<{uri: string; name: string}>,
  ) => Promise<UploadedRecitation[]>;
  updateTags: (id: string, tags: Partial<UploadedRecitation>) => Promise<void>;
  deleteRecitation: (id: string) => Promise<void>;
  refreshRecitations: () => Promise<void>;

  // Custom reciters
  loadCustomReciters: () => Promise<void>;
  createCustomReciter: (name: string) => Promise<CustomReciter>;
  deleteCustomReciter: (id: string) => Promise<void>;

  // Queries (return from cached state)
  getUntagged: () => UploadedRecitation[];
  getByReciter: (reciterId: string) => UploadedRecitation[];
  getByCustomReciter: (customReciterId: string) => UploadedRecitation[];
  getOther: () => UploadedRecitation[];
}

export const useUploadsStore = create<UploadsState>((set, get) => ({
  // Initial state
  recitations: [],
  customReciters: [],
  loading: true,
  error: null,
  isLoading: false,
  totalCount: 0,

  // Load all recitations from database
  loadRecitations: async () => {
    if (get().isLoading) return;

    try {
      set({loading: true, error: null, isLoading: true});
      const allRecitations = await uploadsService.getAll();
      const newRecitations = allRecitations.map(r => ({...r}));
      set({
        recitations: newRecitations,
        totalCount: newRecitations.length,
        loading: false,
        isLoading: false,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load recitations';
      set({error: errorMessage, loading: false, isLoading: false});
    }
  },

  // Import a single file
  importFile: async (sourceUri: string, originalFilename: string) => {
    try {
      set({error: null});
      const recitation = await uploadsService.importFile(
        sourceUri,
        originalFilename,
      );
      // Optimistically add to state
      set(state => ({
        recitations: [recitation, ...state.recitations],
        totalCount: state.totalCount + 1,
      }));
      return recitation;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to import file';
      set({error: errorMessage});
      throw err;
    }
  },

  // Import multiple files
  importFiles: async (files: Array<{uri: string; name: string}>) => {
    try {
      set({error: null});
      const recitations = await uploadsService.importFiles(files);
      // Optimistically add to state
      set(state => ({
        recitations: [...recitations, ...state.recitations],
        totalCount: state.totalCount + recitations.length,
      }));
      return recitations;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to import files';
      set({error: errorMessage});
      throw err;
    }
  },

  // Update tags for a recitation
  updateTags: async (id: string, tags: Partial<UploadedRecitation>) => {
    try {
      set({error: null});
      await uploadsService.updateTags(id, tags);
      // Update in state
      set(state => ({
        recitations: state.recitations.map(r =>
          r.id === id ? {...r, ...tags} : r,
        ),
      }));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update tags';
      set({error: errorMessage});
      // Reload to sync
      await get().loadRecitations();
      throw err;
    }
  },

  // Delete a recitation
  deleteRecitation: async (id: string) => {
    try {
      set({error: null});
      await uploadsService.deleteRecitation(id);
      set(state => ({
        recitations: state.recitations.filter(r => r.id !== id),
        totalCount: state.totalCount - 1,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete recitation';
      set({error: errorMessage});
      throw err;
    }
  },

  refreshRecitations: async () => {
    await get().loadRecitations();
  },

  // Custom reciters
  loadCustomReciters: async () => {
    try {
      const customReciters = await uploadsService.getCustomReciters();
      set({customReciters: customReciters.map(r => ({...r}))});
    } catch (err) {
      console.error('Failed to load custom reciters:', err);
    }
  },

  createCustomReciter: async (name: string) => {
    try {
      set({error: null});
      const reciter = await uploadsService.createCustomReciter(name);
      set(state => ({
        customReciters: [reciter, ...state.customReciters],
      }));
      return reciter;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create reciter';
      set({error: errorMessage});
      throw err;
    }
  },

  deleteCustomReciter: async (id: string) => {
    try {
      set({error: null});
      await uploadsService.deleteCustomReciter(id);
      set(state => ({
        customReciters: state.customReciters.filter(r => r.id !== id),
      }));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete reciter';
      set({error: errorMessage});
      throw err;
    }
  },

  // Derived queries from cached state
  getUntagged: () => {
    return get().recitations.filter(r => r.type === null);
  },

  getByReciter: (reciterId: string) => {
    return get().recitations.filter(r => r.reciterId === reciterId);
  },

  getByCustomReciter: (customReciterId: string) => {
    return get().recitations.filter(r => r.customReciterId === customReciterId);
  },

  getOther: () => {
    return get().recitations.filter(r => r.type === 'other');
  },
}));

/** Lookup a custom reciter name by ID from the store's cached state */
export function getCustomReciterName(id: string): string | null {
  const cr = useUploadsStore.getState().customReciters.find(r => r.id === id);
  return cr?.name ?? null;
}
