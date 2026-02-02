import {useEffect} from 'react';
import {useDuaStore} from '@/store/duaStore';

/**
 * Hook to access and manage duas.
 * This hook wraps the Zustand store to provide a consistent API
 * while ensuring all components share the same state.
 *
 * The store acts as a single source of truth, so updates from one
 * component automatically propagate to all other components using this hook.
 */
export function useDuas() {
  // Get state and actions from the Zustand store
  const allCategories = useDuaStore(state => state.allCategories);
  const groupedCategories = useDuaStore(state => state.groupedCategories);
  const selectedCategory = useDuaStore(state => state.selectedCategory);
  const duasInCategory = useDuaStore(state => state.duasInCategory);
  const currentDua = useDuaStore(state => state.currentDua);
  const currentDuaIndex = useDuaStore(state => state.currentDuaIndex);
  const favorites = useDuaStore(state => state.favorites);
  const loading = useDuaStore(state => state.loading);
  const categoriesLoaded = useDuaStore(state => state.categoriesLoaded);
  const error = useDuaStore(state => state.error);

  // Actions
  const loadCategories = useDuaStore(state => state.loadCategories);
  const selectCategory = useDuaStore(state => state.selectCategory);
  const setCurrentDua = useDuaStore(state => state.setCurrentDua);
  const navigateToDua = useDuaStore(state => state.navigateToDua);
  const toggleFavorite = useDuaStore(state => state.toggleFavorite);
  const loadFavorites = useDuaStore(state => state.loadFavorites);
  const incrementCount = useDuaStore(state => state.incrementCount);
  const resetCount = useDuaStore(state => state.resetCount);
  const getCount = useDuaStore(state => state.getCount);
  const reset = useDuaStore(state => state.reset);

  // Helper function to check if a dua is favorited
  const isFavorite = (duaId: string): boolean => {
    return favorites.has(duaId);
  };

  // Safety fallback: Load categories if not already loaded by AppInitializer
  // This should rarely execute as AppInitializer preloads data on app startup
  useEffect(() => {
    // Only load if we haven't loaded categories yet and we're not currently loading
    if (!categoriesLoaded && !loading) {
      console.warn(
        '[useDuas] Categories not preloaded, loading as fallback...',
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

    // Current state
    selectedCategory,
    duasInCategory,
    currentDua,
    currentDuaIndex,

    // Favorites
    favorites,
    isFavorite,

    // Counts
    getCount,

    // Actions
    loadCategories,
    selectCategory,
    setCurrentDua,
    navigateToDua,
    toggleFavorite,
    loadFavorites,
    incrementCount,
    resetCount,
    reset,
  };
}
