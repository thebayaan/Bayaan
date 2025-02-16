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
 */
export function getReciterArtwork(reciter: Reciter): string {
  // 1. Try remote URL first
  if (reciter.image_url) {
    return reciter.image_url;
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

  // 3. Return a data URL for a placeholder image
  // This creates a 1x1 pixel transparent PNG as a minimal fallback
  // Android requires a valid URL, so we provide this as a last resort
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
}
