// @ai-generated
import type {ImageSourcePropType} from 'react-native';
import {reciterImages} from './reciterImages';

/**
 * Catalog names whose key does not match the photo's file name. Keys and
 * values are both in reciterImageKey form. Add an entry here when a reciter
 * is renamed in the catalog instead of renaming the photo.
 */
const RECITER_IMAGE_ALIASES: Readonly<Record<string, string>> = {
  'mahmood-alsheimy': 'mahmoud-el-sheimy',
};

/**
 * Turns a reciter name into a key of `reciterImages`. Must match
 * normalizeFileName in scripts/generateReciterImages.ts, which builds those
 * keys from the photo file names: lowercase, spaces to hyphens, anything
 * other than a-z, 0-9 and hyphens dropped.
 */
export function reciterImageKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The bundled photo for a reciter, if the app ships one. */
export function getLocalReciterImage(
  name: string | null | undefined,
): ImageSourcePropType | undefined {
  if (!name) return undefined;
  const key = reciterImageKey(name);
  return reciterImages[RECITER_IMAGE_ALIASES[key] ?? key];
}
