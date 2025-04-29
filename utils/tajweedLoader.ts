import {TajweedData, useTajweedStore} from '@/store/tajweedStore';

/**
 * Preloads tajweed data in the background.
 * This function should be called early in the app lifecycle.
 * @returns Promise that resolves when data is loaded
 */
export const preloadTajweedData = async (): Promise<void> => {
  const {setTajweedData, setIsLoading, setError} = useTajweedStore.getState();
  
  try {
    setIsLoading(true);
    
    // Using dynamic import instead of require to avoid blocking UI thread
    // Note: For React Native, you may need to ensure this works with your bundler
    const tajweedModule = await import('@/data/QPC Hafs Tajweed 2.json');
    const tajweedData = tajweedModule.default as TajweedData;
    
    setTajweedData(tajweedData);
    console.log('Tajweed data preloaded successfully');
  } catch (error) {
    console.error('Error preloading tajweed data:', error);
    setError(error instanceof Error ? error.message : 'Unknown error loading tajweed data');
  } finally {
    setIsLoading(false);
  }
};

/**
 * Alternative implementation using a separate thread with setTimeout
 * Use this if dynamic import doesn't work well in React Native
 */
export const preloadTajweedDataWithTimeout = (): void => {
  const {setTajweedData, setIsLoading, setError} = useTajweedStore.getState();
  
  setIsLoading(true);
  
  // Use setTimeout to move the heavy loading off the main thread
  setTimeout(() => {
    try {
      // This still blocks, but at least it's deferred
      const tajweedData = require('@/data/QPC Hafs Tajweed 2.json') as TajweedData;
      setTajweedData(tajweedData);
      console.log('Tajweed data preloaded successfully');
    } catch (error) {
      console.error('Error preloading tajweed data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error loading tajweed data');
    } finally {
      setIsLoading(false);
    }
  }, 100); // Small delay to let the UI render first
}; 