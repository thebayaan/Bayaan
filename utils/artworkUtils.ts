import {Image} from 'react-native';
import {reciterImages} from './reciterImages';
import {Reciter} from '@/data/reciterData';

/**
 * Formats a reciter name to match our local image naming convention
 */
function formatReciterName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
}

/**
 * Gets the artwork URL for a reciter, with fallbacks:
 * 1. Remote URL if available
 * 2. Local asset if available
 * 3. Generated placeholder URL
 * 
 * Ensures the URL is valid and accessible for Android notification tray
 */
export function getReciterArtwork(reciter: Reciter): string {
  // Fail fast if no reciter provided
  if (!reciter) {
    return getDefaultArtwork();
  }

  // 1. Try remote URL first - ensure it's HTTPS for Android compatibility
  if (reciter.image_url) {
    const url = reciter.image_url;
    // Ensure URL is HTTPS for Android compatibility
    if (url.startsWith('https://')) {
      return url;
    }
    // Convert HTTP to HTTPS if possible
    if (url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
  }

  // 2. Try local asset
  const formattedName = formatReciterName(reciter.name);
  const localImage = reciterImages[formattedName];
  if (localImage) {
    const resolvedImage = Image.resolveAssetSource(localImage);
    if (resolvedImage?.uri) {
      return resolvedImage.uri;
    }
  }

  // 3. Return default artwork
  return getDefaultArtwork();
}

/**
 * Returns a default artwork image for fallback
 * This creates a 1x1 pixel transparent PNG as a minimal fallback
 * Android requires a valid URL, so we provide this as a last resort
 */
function getDefaultArtwork(): string {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
}
