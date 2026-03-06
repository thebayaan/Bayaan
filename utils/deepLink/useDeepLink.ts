import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { handleDeepLink } from './handler';

/**
 * Hook to handle deep linking in the app
 */
export function useDeepLink() {
  useEffect(() => {
    // Handle the app being opened from a deep link
    const getInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('[DeepLink] App opened with initial URL:', initialUrl);
          // Small delay to ensure the app is fully initialized
          setTimeout(() => {
            handleDeepLink(initialUrl);
          }, 100);
        }
      } catch (error) {
        console.error('[DeepLink] Error getting initial URL:', error);
      }
    };

    // Handle the app being opened while already running
    const handleUrl = (event: { url: string }) => {
      console.log('[DeepLink] App received URL while running:', event.url);
      handleDeepLink(event.url);
    };

    // Set up the listeners
    getInitialUrl();
    const subscription = Linking.addEventListener('url', handleUrl);

    // Cleanup
    return () => {
      subscription?.remove();
    };
  }, []);
}
