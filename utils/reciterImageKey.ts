// @ai-generated
/**
 * How a bundled reciter photo is found from the reciter's display name. Pure
 * (no image requires), so the app and the scripts in scripts/ share it.
 */

/**
 * Catalog names whose key does not match the photo's file name. Keys and
 * values are both in reciterImageKey form. Add an entry here when a reciter
 * is renamed in the catalog instead of renaming the photo.
 */
const RECITER_IMAGE_ALIASES: Readonly<Record<string, string>> = {
  'mahmood-alsheimy': 'mahmoud-el-sheimy',
};

/**
 * Turns a name (or a photo's file name) into a key of `reciterImages`:
 * lowercase, spaces to hyphens, anything other than a-z, 0-9 and hyphens
 * dropped. scripts/generateReciterImages.ts builds the keys with this too.
 */
export function reciterImageKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The `reciterImages` key of a reciter's bundled photo, aliases applied. */
export function bundledImageKey(name: string): string {
  const key = reciterImageKey(name);
  return RECITER_IMAGE_ALIASES[key] ?? key;
}
