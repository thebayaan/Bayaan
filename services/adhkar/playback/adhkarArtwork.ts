// services/adhkar/playback/adhkarArtwork.ts
// Lock screen artwork for the adhkar session: the list's illustration (the one
// AdhkarSessionArtwork shows), or the app icon for Saved and any list without
// one. The native now playing layers fetch artwork by URL, so the bundled
// image is copied to a local file first.
import {Asset} from 'expo-asset';
import {ADHKAR_CATEGORY_IMAGES} from '@/constants/adhkarImages';

const APP_ICON: unknown = require('@/assets/images/icon.png');

// require() of a bundled image is an asset id at runtime; the image map types
// it as an expo-image source.
function assetId(source: unknown): number | null {
  return typeof source === 'number' ? source : null;
}

/**
 * The bundled image for a list's lock screen artwork. Always the dark
 * illustration: it reads on the lock screen whatever the app's theme.
 */
export function adhkarArtworkAsset(
  listId: string,
  images: Readonly<Record<string, {dark: unknown}>> = ADHKAR_CATEGORY_IMAGES,
  fallback: unknown = APP_ICON,
): number | null {
  return assetId(images[listId]?.dark) ?? assetId(fallback);
}

const uris = new Map<string, string>();

/** The artwork URL already resolved for this list, if any. */
export function cachedAdhkarArtworkUri(listId: string): string | undefined {
  return uris.get(listId);
}

/** Resolves (once per list) a file URL the native layers can load. */
export async function loadAdhkarArtworkUri(
  listId: string,
): Promise<string | null> {
  const cached = uris.get(listId);
  if (cached) return cached;
  const id = adhkarArtworkAsset(listId);
  if (id === null) return null;
  const asset = Asset.fromModule(id);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) return null;
  uris.set(listId, uri);
  return uri;
}
