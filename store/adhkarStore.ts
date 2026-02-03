import {create} from 'zustand';
import {
  adhkarService,
  AdhkarCategory,
  Dhikr,
  AdhkarBroadTag,
  DhikrFavorite,
  SuperCategory,
} from '@/services/adhkar/AdhkarService';

interface AdhkarState {
  // Categories
  allCategories: AdhkarCategory[];
  groupedCategories: Record<AdhkarBroadTag, AdhkarCategory[]>;

  // Super Categories (Life With Allah-style groupings)
  mainSuperCategories: SuperCategory[];
  otherSuperCategories: SuperCategory[];
  superCategoriesLoaded: boolean;

  // Current selections
  selectedCategory: AdhkarCategory | null;
  adhkarInCategory: Dhikr[];
  currentDhikr: Dhikr | null;
  currentDhikrIndex: number;

  // Favorites (Set of dhikr IDs)
  favorites: Set<string>;

  // Tasbeeh counts
  dhikrCounts: Record<string, number>;

  // Loading states
  loading: boolean;
  categoriesLoaded: boolean;
  error: string | null;
  isLoading: boolean; // Internal flag to prevent concurrent loads

  // Actions
  loadCategories: () => Promise<void>;
  loadSuperCategories: () => Promise<void>;
  selectCategory: (categoryId: string) => Promise<void>;
  setCurrentDhikr: (dhikr: Dhikr, index: number) => void;
  navigateToDhikr: (direction: 'prev' | 'next') => void;
  getSuperCategoryById: (id: string) => SuperCategory | undefined;

  // Favorites
  toggleFavorite: (dhikrId: string) => Promise<void>;
  loadFavorites: () => Promise<void>;

  // Tasbeeh
  incrementCount: (dhikrId: string) => Promise<number>;
  resetCount: (dhikrId: string) => Promise<void>;
  getCount: (dhikrId: string) => number;

  // Direct adhkar list setter (for super category navigation)
  setAdhkarList: (adhkar: Dhikr[]) => void;

  // Reset
  reset: () => void;
}

// Initial grouped categories with all broad tags
const initialGroupedCategories: Record<AdhkarBroadTag, AdhkarCategory[]> = {
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

export const useAdhkarStore = create<AdhkarState>((set, get) => ({
  // Initial state
  allCategories: [],
  groupedCategories: initialGroupedCategories,
  mainSuperCategories: [],
  otherSuperCategories: [],
  superCategoriesLoaded: false,
  selectedCategory: null,
  adhkarInCategory: [],
  currentDhikr: null,
  currentDhikrIndex: 0,
  favorites: new Set<string>(),
  dhikrCounts: {},
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
        adhkarService.getAllCategories(),
        adhkarService.getGroupedCategories(),
      ]);

      // Load favorites
      const favorites = await adhkarService.getFavorites();
      const favoriteIds = new Set(
        favorites.map((f: DhikrFavorite) => f.dhikrId),
      );

      // Load counts (this can be slow, so we do it after categories are loaded)
      const counts = await adhkarService.getAllCounts();

      set({
        allCategories,
        groupedCategories,
        favorites: favoriteIds,
        dhikrCounts: counts,
        loading: false,
        categoriesLoaded: true,
        isLoading: false,
      });

      // Also load super categories
      await get().loadSuperCategories();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load categories';
      set({error: errorMessage, loading: false, isLoading: false});
    }
  },

  // Load super categories from database
  loadSuperCategories: async () => {
    try {
      const [mainSuperCategories, otherSuperCategories] = await Promise.all([
        adhkarService.getSuperCategoriesBySection('main'),
        adhkarService.getSuperCategoriesBySection('other'),
      ]);

      set({
        mainSuperCategories,
        otherSuperCategories,
        superCategoriesLoaded: true,
      });
    } catch (err) {
      console.error('Failed to load super categories:', err);
    }
  },

  // Get super category by ID
  getSuperCategoryById: (id: string) => {
    const {mainSuperCategories, otherSuperCategories} = get();
    return (
      mainSuperCategories.find(cat => cat.id === id) ||
      otherSuperCategories.find(cat => cat.id === id)
    );
  },

  // Select a category and load its adhkar
  selectCategory: async (categoryId: string) => {
    try {
      set({error: null});

      // Find the category from allCategories
      const category = get().allCategories.find(c => c.id === categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      // Load adhkar in this category
      const adhkar = await adhkarService.getAdhkarInCategory(categoryId);

      set({
        selectedCategory: category,
        adhkarInCategory: adhkar,
        currentDhikr: adhkar.length > 0 ? adhkar[0] : null,
        currentDhikrIndex: 0,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to select category';
      set({error: errorMessage});
    }
  },

  // Set the current dhikr being viewed
  setCurrentDhikr: (dhikr: Dhikr, index: number) => {
    set({
      currentDhikr: dhikr,
      currentDhikrIndex: index,
    });
  },

  // Navigate to previous or next dhikr
  navigateToDhikr: (direction: 'prev' | 'next') => {
    const {adhkarInCategory, currentDhikrIndex} = get();

    if (adhkarInCategory.length === 0) return;

    let newIndex: number;
    if (direction === 'prev') {
      // Wrap around to the end if at the beginning
      newIndex =
        currentDhikrIndex > 0
          ? currentDhikrIndex - 1
          : adhkarInCategory.length - 1;
    } else {
      // Wrap around to the beginning if at the end
      newIndex =
        currentDhikrIndex < adhkarInCategory.length - 1
          ? currentDhikrIndex + 1
          : 0;
    }

    set({
      currentDhikr: adhkarInCategory[newIndex],
      currentDhikrIndex: newIndex,
    });
  },

  // Toggle favorite status for a dhikr
  toggleFavorite: async (dhikrId: string) => {
    try {
      set({error: null});

      const isFavorite = await adhkarService.toggleFavorite(dhikrId);

      // Update favorites Set immutably
      const currentFavorites = get().favorites;
      const newFavorites = new Set(currentFavorites);

      if (isFavorite) {
        newFavorites.add(dhikrId);
      } else {
        newFavorites.delete(dhikrId);
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

      const favorites = await adhkarService.getFavorites();
      const favoriteIds = new Set(
        favorites.map((f: DhikrFavorite) => f.dhikrId),
      );

      set({favorites: favoriteIds});
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load favorites';
      set({error: errorMessage});
    }
  },

  // Increment tasbeeh count for a dhikr
  incrementCount: async (dhikrId: string) => {
    try {
      set({error: null});

      const newCount = await adhkarService.incrementDhikrCount(dhikrId);

      // Update counts immutably
      set(state => ({
        dhikrCounts: {
          ...state.dhikrCounts,
          [dhikrId]: newCount,
        },
      }));

      return newCount;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to increment count';
      set({error: errorMessage});
      return get().dhikrCounts[dhikrId] ?? 0;
    }
  },

  // Reset tasbeeh count for a dhikr
  resetCount: async (dhikrId: string) => {
    try {
      set({error: null});

      await adhkarService.resetDhikrCount(dhikrId);

      // Update counts immutably
      set(state => {
        const newCounts = {...state.dhikrCounts};
        delete newCounts[dhikrId];
        return {dhikrCounts: newCounts};
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to reset count';
      set({error: errorMessage});
    }
  },

  // Get the current count for a dhikr (synchronous, from cached state)
  getCount: (dhikrId: string) => {
    return get().dhikrCounts[dhikrId] ?? 0;
  },

  // Set adhkar list directly (used for super category navigation)
  setAdhkarList: (adhkar: Dhikr[]) => {
    set({
      adhkarInCategory: adhkar,
      selectedCategory: null, // Clear selected category since we're using a custom list
    });
  },

  // Reset all state to initial values
  reset: () => {
    set({
      allCategories: [],
      groupedCategories: initialGroupedCategories,
      mainSuperCategories: [],
      otherSuperCategories: [],
      superCategoriesLoaded: false,
      selectedCategory: null,
      adhkarInCategory: [],
      currentDhikr: null,
      currentDhikrIndex: 0,
      favorites: new Set<string>(),
      dhikrCounts: {},
      loading: true,
      categoriesLoaded: false,
      error: null,
      isLoading: false,
    });
  },
}));
