import { router } from 'expo-router';
import * as Linking from 'expo-linking';

interface DeepLinkRoute {
  screen: string;
  params?: Record<string, any>;
}

/**
 * Parse a deep link URL and extract route information
 */
export function parseDeepLink(url: string): DeepLinkRoute | null {
  try {
    console.log('[DeepLink] Parsing URL:', url);
    
    // Parse the URL
    const parsed = Linking.parse(url);
    console.log('[DeepLink] Parsed URL:', parsed);
    
    const { path, queryParams } = parsed;
    
    if (!path) {
      console.log('[DeepLink] No path found, navigating to home');
      return { screen: '/(tabs)/(a.home)/' };
    }
    
    // Remove leading slash
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const segments = cleanPath.split('/').filter(Boolean);
    
    console.log('[DeepLink] Path segments:', segments);
    
    if (segments.length === 0) {
      return { screen: '/(tabs)/(a.home)/' };
    }
    
    // Handle different route patterns
    switch (segments[0]) {
      case 'reciter': {
        if (segments.length >= 2) {
          const reciterId = segments[1];
          
          // Check if it's a specific surah: /reciter/{id}/surah/{num}
          if (segments.length >= 4 && segments[2] === 'surah') {
            const surahNum = segments[3];
            return {
              screen: '/(tabs)/(a.home)/reciter/[id]',
              params: {
                id: reciterId,
                surah: surahNum,
                autoplay: queryParams?.autoplay === 'true' ? true : undefined,
                ...queryParams,
              },
            };
          }
          
          // Just reciter profile: /reciter/{id}
          return {
            screen: '/(tabs)/(a.home)/reciter/[id]',
            params: { id: reciterId, ...queryParams },
          };
        }
        break;
      }
      
      case 'playlist': {
        if (segments.length >= 2) {
          const playlistId = segments[1];
          return {
            screen: '/(tabs)/(a.home)/playlist/[id]',
            params: { id: playlistId, ...queryParams },
          };
        }
        break;
      }
      
      case 'surah': {
        if (segments.length >= 2) {
          const surahNum = segments[1];
          return {
            screen: '/(tabs)/(a.home)/',
            params: {
              surah: surahNum,
              reciter: queryParams?.reciter,
              autoplay: queryParams?.autoplay === 'true' ? true : undefined,
              ...queryParams,
            },
          };
        }
        break;
      }
      
      case 'adhkar': {
        if (segments.length >= 2) {
          const superId = segments[1];
          
          // Check if it's a specific dhikr: /adhkar/{superId}/{dhikrId}
          if (segments.length >= 3) {
            const dhikrId = segments[2];
            return {
              screen: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
              params: { superId, dhikrId, ...queryParams },
            };
          }
          
          // Just adhkar category: /adhkar/{superId}
          return {
            screen: '/(tabs)/(a.home)/adhkar/[superId]/',
            params: { superId, ...queryParams },
          };
        }
        break;
      }
      
      // Add more route patterns as needed
      default:
        console.log('[DeepLink] Unknown route pattern:', segments[0]);
        break;
    }
    
    // Fallback to home
    console.log('[DeepLink] Fallback to home');
    return { screen: '/(tabs)/(a.home)/' };
    
  } catch (error) {
    console.error('[DeepLink] Error parsing URL:', error);
    return null;
  }
}

/**
 * Handle incoming deep link
 */
export function handleDeepLink(url: string): boolean {
  try {
    console.log('[DeepLink] Handling deep link:', url);
    
    const route = parseDeepLink(url);
    if (!route) {
      console.error('[DeepLink] Failed to parse route');
      return false;
    }
    
    console.log('[DeepLink] Navigating to:', route);
    
    // Navigate to the parsed route
    if (route.params && Object.keys(route.params).length > 0) {
      router.navigate({
        pathname: route.screen as any,
        params: route.params,
      });
    } else {
      router.navigate(route.screen as any);
    }
    
    return true;
  } catch (error) {
    console.error('[DeepLink] Error handling deep link:', error);
    return false;
  }
}

/**
 * Generate a shareable deep link for app content
 */
export function generateShareableLink(type: string, params: Record<string, any>): string {
  const baseUrl = 'https://thebayaan.com';
  
  switch (type) {
    case 'reciter': {
      const { id, surah } = params;
      if (surah) {
        return `${baseUrl}/reciter/${id}/surah/${surah}`;
      }
      return `${baseUrl}/reciter/${id}`;
    }
    
    case 'playlist': {
      const { id } = params;
      return `${baseUrl}/playlist/${id}`;
    }
    
    case 'surah': {
      const { num, reciter } = params;
      const queryString = reciter ? `?reciter=${reciter}` : '';
      return `${baseUrl}/surah/${num}${queryString}`;
    }
    
    case 'adhkar': {
      const { superId, dhikrId } = params;
      if (dhikrId) {
        return `${baseUrl}/adhkar/${superId}/${dhikrId}`;
      }
      return `${baseUrl}/adhkar/${superId}`;
    }
    
    default:
      return baseUrl;
  }
}
