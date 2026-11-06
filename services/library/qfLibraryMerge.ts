// @ai-generated
/**
 * Library documents are compared and merged as flat entry maps: item key to
 * an encoded item value. A missing key is an absent item.
 */
export type LibraryEntries = Readonly<Record<string, string>>;

export const EMPTY_ENTRIES: LibraryEntries = Object.freeze({});

export function sameEntries(left: LibraryEntries, right: LibraryEntries) {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every(key => right[key] === left[key]);
}

/**
 * Three-way merge per item against the copy last synced. A side that left an
 * item unchanged takes the other side's value; when both changed the same
 * item, this device wins.
 */
export function mergeEntries(
  base: LibraryEntries,
  local: LibraryEntries,
  remote: LibraryEntries,
): Record<string, string> {
  const merged: Record<string, string> = {};
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);
  for (const key of keys) {
    const value = local[key] === base[key] ? remote[key] : local[key];
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

/**
 * Merges a whole document that either side may have deleted (`null`), as
 * playlists are. A delete wins over an unchanged copy; an edit wins over a
 * delete, so nobody loses work they just did.
 */
export function mergeDocument(
  base: LibraryEntries | null,
  local: LibraryEntries | null,
  remote: LibraryEntries | null,
): Record<string, string> | null {
  if (local === null && remote === null) return null;
  if (local === null) {
    return base !== null && sameEntries(base, remote!) ? null : {...remote!};
  }
  if (remote === null) {
    return base !== null && sameEntries(base, local) ? null : {...local};
  }
  return mergeEntries(base ?? EMPTY_ENTRIES, local, remote);
}
