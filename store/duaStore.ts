import {create} from 'zustand';
import {
  duaService,
  DuaCategory,
  Dua,
  DuaBroadTag,
  DuaFavorite,
} from '@/services/dua/DuaService';

interface DuaState {
  // Categories
  allCategories: DuaCategory[];
  groupedCategories: Record<DuaBroadTag, DuaCategory[]>;

  // Current selections
  selectedCategory: DuaCategory | null;
  duasInCategory: Dua[];
  currentDua: Dua | null;
  currentDuaIndex: number;

  // Favorites (Set of dua IDs)
  favorites: Set<string>;

  // Tasbeeh counts
  duaCounts: Record<string, number>;

  // Loading states
  loading: boolean;
  categoriesLoaded: boolean;
  error: string | null;
  isLoading: boolean; // Internal flag to prevent concurrent loads

  // Actions
  loadCategories: () => Promise<void>;
  selectCategory: (categoryId: string) => Promise<void>;
  setCurrentDua: (dua: Dua, index: number) => void;
  navigateToDua: (direction: 'prev' | 'next') => void;

  // Favorites
  toggleFavorite: (duaId: string) => Promise<void>;
  loadFavorites: () => Promise<void>;

  // Tasbeeh
  incrementCount: (duaId: string) => Promise<number>;
  resetCount: (duaId: string) => Promise<void>;
  getCount: (duaId: string) => number;

  // Reset
  reset: () => void;
}

// Initial grouped categories with all broad tags
const initialGroupedCategories: Record<DuaBroadTag, DuaCategory[]> = {
  daily: [],
  prayer: [],
  protection: [],
  health: [],
  travel: [],
  food: [],
  social: [],
  nature: [],
  spiritual: [],
  home: [],
  clothing: [],
  general: [],
};

export const useDuaStore = create<DuaState>((set, get) => ({
  // Initial state
  allCategories: [],
  groupedCategories: initialGroupedCategories,
  selectedCategory: null,
  duasInCategory: [],
  currentDua: null,
  currentDuaIndex: 0,
  favorites: new Set<string>(),
  duaCounts: {},
  loading: true, // Start as loading to indicate we haven't loaded yet
  categoriesLoaded: false,
  error: null,
  isLoading: false, // Internal flag to prevent concurrent loads

  // Load all categories from database
  loadCategories: async () => {
    // Prevent concurrent loads
    if (get().isLoading) {
      return;
    }

    try {
      set({loading: true, error: null, isLoading: true});

      // Load categories and grouped categories in parallel
      const [allCategories, groupedCategories] = await Promise.all([
        duaService.getAllCategories(),
        duaService.getGroupedCategories(),
      ]);

      // Load favorites
      const favorites = await duaService.getFavorites();
      const favoriteIds = new Set(favorites.map((f: DuaFavorite) => f.duaId));

      // Load counts (this can be slow, so we do it after categories are loaded)
      const counts = await duaService.getAllCounts();

      set({
        allCategories,
        groupedCategories,
        favorites: favoriteIds,
        duaCounts: counts,
        loading: false,
        categoriesLoaded: true,
        isLoading: false,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load categories';
      set({error: errorMessage, loading: false, isLoading: false});
    }
  },

  // Select a category and load its duas
  selectCategory: async (categoryId: string) => {
    try {
      set({error: null});

      // Find the category from allCategories
      const category = get().allCategories.find(c => c.id === categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      // Load duas in this category
      const duas = await duaService.getDuasInCategory(categoryId);

      set({
        selectedCategory: category,
        duasInCategory: duas,
        currentDua: duas.length > 0 ? duas[0] : null,
        currentDuaIndex: 0,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to select category';
      set({error: errorMessage});
    }
  },

  // Set the current dua being viewed
  setCurrentDua: (dua: Dua, index: number) => {
    set({
      currentDua: dua,
      currentDuaIndex: index,
    });
  },

  // Navigate to previous or next dua
  navigateToDua: (direction: 'prev' | 'next') => {
    const {duasInCategory, currentDuaIndex} = get();

    if (duasInCategory.length === 0) return;

    let newIndex: number;
    if (direction === 'prev') {
      // Wrap around to the end if at the beginning
      newIndex =
        currentDuaIndex > 0 ? currentDuaIndex - 1 : duasInCategory.length - 1;
    } else {
      // Wrap around to the beginning if at the end
      newIndex =
        currentDuaIndex < duasInCategory.length - 1 ? currentDuaIndex + 1 : 0;
    }

    set({
      currentDua: duasInCategory[newIndex],
      currentDuaIndex: newIndex,
    });
  },

  // Toggle favorite status for a dua
  toggleFavorite: async (duaId: string) => {
    try {
      set({error: null});

      const isFavorite = await duaService.toggleFavorite(duaId);

      // Update favorites Set immutably
      const currentFavorites = get().favorites;
      const newFavorites = new Set(currentFavorites);

      if (isFavorite) {
        newFavorites.add(duaId);
      } else {
        newFavorites.delete(duaId);
      }

      set({favorites: newFavorites});
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to toggle favorite';
      set({error: errorMessage});
    }
  },

  // Load all favorites from database
  loadFavorites: async () => {
    try {
      set({error: null});

      const favorites = await duaService.getFavorites();
      const favoriteIds = new Set(favorites.map((f: DuaFavorite) => f.duaId));

      set({favorites: favoriteIds});
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load favorites';
      set({error: errorMessage});
    }
  },

  // Increment tasbeeh count for a dua
  incrementCount: async (duaId: string) => {
    try {
      set({error: null});

      const newCount = await duaService.incrementDuaCount(duaId);

      // Update counts immutably
      set(state => ({
        duaCounts: {
          ...state.duaCounts,
          [duaId]: newCount,
        },
      }));

      return newCount;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to increment count';
      set({error: errorMessage});
      return get().duaCounts[duaId] ?? 0;
    }
  },

  // Reset tasbeeh count for a dua
  resetCount: async (duaId: string) => {
    try {
      set({error: null});

      await duaService.resetDuaCount(duaId);

      // Update counts immutably
      set(state => {
        const newCounts = {...state.duaCounts};
        delete newCounts[duaId];
        return {duaCounts: newCounts};
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to reset count';
      set({error: errorMessage});
    }
  },

  // Get the current count for a dua (synchronous, from cached state)
  getCount: (duaId: string) => {
    return get().duaCounts[duaId] ?? 0;
  },

  // Reset all state to initial values
  reset: () => {
    set({
      allCategories: [],
      groupedCategories: initialGroupedCategories,
      selectedCategory: null,
      duasInCategory: [],
      currentDua: null,
      currentDuaIndex: 0,
      favorites: new Set<string>(),
      duaCounts: {},
      loading: true,
      categoriesLoaded: false,
      error: null,
      isLoading: false,
    });
  },
}));
