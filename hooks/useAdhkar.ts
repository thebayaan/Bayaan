import {useEffect} from 'react';
import {useAdhkarStore} from '@/store/adhkarStore';

/**
 * Hook to access and manage adhkar.
 * This hook wraps the Zustand store to provide a consistent API
 * while ensuring all components share the same state.
 *
 * The store acts as a single source of truth, so updates from one
 * component automatically propagate to all other components using this hook.
 */
export function useAdhkar() {
  // Get state and actions from the Zustand store
  const allCategories = useAdhkarStore(state => state.allCategories);
  const groupedCategories = useAdhkarStore(state => state.groupedCategories);
  const mainSuperCategories = useAdhkarStore(
    state => state.mainSuperCategories,
  );
  const otherSuperCategories = useAdhkarStore(
    state => state.otherSuperCategories,
  );
  const superCategoriesLoaded = useAdhkarStore(
    state => state.superCategoriesLoaded,
  );
  const selectedCategory = useAdhkarStore(state => state.selectedCategory);
  const adhkarInCategory = useAdhkarStore(state => state.adhkarInCategory);
  const currentDhikr = useAdhkarStore(state => state.currentDhikr);
  const currentDhikrIndex = useAdhkarStore(state => state.currentDhikrIndex);
  const favorites = useAdhkarStore(state => state.favorites);
  const loading = useAdhkarStore(state => state.loading);
  const categoriesLoaded = useAdhkarStore(state => state.categoriesLoaded);
  const error = useAdhkarStore(state => state.error);

  // Actions
  const loadCategories = useAdhkarStore(state => state.loadCategories);
  const loadSuperCategories = useAdhkarStore(
    state => state.loadSuperCategories,
  );
  const selectCategory = useAdhkarStore(state => state.selectCategory);
  const setCurrentDhikr = useAdhkarStore(state => state.setCurrentDhikr);
  const navigateToDhikr = useAdhkarStore(state => state.navigateToDhikr);
  const getSuperCategoryById = useAdhkarStore(
    state => state.getSuperCategoryById,
  );
  const toggleFavorite = useAdhkarStore(state => state.toggleFavorite);
  const loadFavorites = useAdhkarStore(state => state.loadFavorites);
  const incrementCount = useAdhkarStore(state => state.incrementCount);
  const resetCount = useAdhkarStore(state => state.resetCount);
  const getCount = useAdhkarStore(state => state.getCount);
  const setAdhkarList = useAdhkarStore(state => state.setAdhkarList);
  const reset = useAdhkarStore(state => state.reset);

  // Helper function to check if a dhikr is favorited
  const isFavorite = (dhikrId: string): boolean => {
    return favorites.has(dhikrId);
  };

  // Safety fallback: Load categories if not already loaded by AppInitializer
  // This should rarely execute as AppInitializer preloads data on app startup
  useEffect(() => {
    // Only load if we haven't loaded categories yet and we're not currently loading
    if (!categoriesLoaded && !loading) {
      console.warn(
        '[useAdhkar] Categories not preloaded, loading as fallback...',
      );
      loadCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount

  return {
    // Categories
    categories: allCategories,
    groupedCategories,
    loading,
    categoriesLoaded,
    error,

    // Super Categories
    mainSuperCategories,
    otherSuperCategories,
    superCategoriesLoaded,

    // Current state
    selectedCategory,
    adhkarInCategory,
    currentDhikr,
    currentDhikrIndex,

    // Favorites
    favorites,
    isFavorite,

    // Counts
    getCount,

    // Actions
    loadCategories,
    loadSuperCategories,
    selectCategory,
    setCurrentDhikr,
    setAdhkarList,
    navigateToDhikr,
    getSuperCategoryById,
    toggleFavorite,
    loadFavorites,
    incrementCount,
    resetCount,
    reset,
  };
}
