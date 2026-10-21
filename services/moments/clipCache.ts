// @ai-start
/**
 * On-disk cache of pre-cut Moments clips.
 *
 * Clips the backend serves (`clipUrl`) are downloaded into their own folder
 * under the cache directory, a few cards ahead of the one on screen. The
 * folder is capped at about 100 MB: once over, the clips played least
 * recently are deleted first (a clip that was downloaded but never played
 * counts from its download). An index in AsyncStorage keeps each clip's size
 * and last use; it is checked against the folder when the cache opens, so a
 * clip deleted by the system or a half-finished download is forgotten.
 */

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MOMENTS_CACHE_DIR_NAME = 'moments-clips/';
export const MOMENTS_CACHE_CAP_BYTES = 100 * 1024 * 1024;
export const MOMENTS_CACHE_INDEX_KEY = 'moments-clip-cache-index';
const PARTIAL_SUFFIX = '.download';

/** Clean-up that may fail without consequence (the file is already gone). */
const ignoreError = (): void => undefined;

export interface CachedClipEntry {
  fileName: string;
  size: number;
  /** Last played, or when it was downloaded if it was never played. */
  lastUsedAt: number;
}

export interface ClipRequest {
  id: string;
  url: string;
}

/**
 * File names to delete, least recently used first, until the cache fits in
 * `capBytes`. Protected files (the cards around the one on screen) are kept
 * even when that leaves the cache over the cap.
 */
export function planEviction(
  entries: CachedClipEntry[],
  capBytes: number,
  protectedNames: ReadonlySet<string> = new Set(),
): string[] {
  let total = entries.reduce((sum, e) => sum + e.size, 0);
  if (total <= capBytes) return [];
  const evict: string[] = [];
  const byAge = [...entries]
    .filter(e => !protectedNames.has(e.fileName))
    .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  for (const entry of byAge) {
    if (total <= capBytes) break;
    evict.push(entry.fileName);
    total -= entry.size;
  }
  return evict;
}

/** A safe file name for a snippet's clip, keeping the URL's extension. */
export function clipFileName(id: string, url: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = url.split(/[?#]/)[0];
  const match = /\.([a-zA-Z0-9]{2,4})$/.exec(path);
  return `${safeId}.${match ? match[1].toLowerCase() : 'mp3'}`;
}

export class MomentsClipCache {
  private entries = new Map<string, CachedClipEntry>();
  private ready: Promise<void> | null = null;
  private queue: ClipRequest[] = [];
  private protectedNames = new Set<string>();
  private downloading: string | null = null;
  /** Bumped by clear() so a download that was running is thrown away. */
  private generation = 0;

  constructor(
    private readonly capBytes: number = MOMENTS_CACHE_CAP_BYTES,
    private readonly now: () => number = Date.now,
  ) {}

  private get dir(): string | null {
    return FileSystem.cacheDirectory
      ? `${FileSystem.cacheDirectory}${MOMENTS_CACHE_DIR_NAME}`
      : null;
  }

  /** Loads the index and reconciles it with the folder. Safe to call often. */
  init(): Promise<void> {
    if (!this.ready) {
      this.ready = this.open().catch(error => {
        if (__DEV__) console.warn('[MomentsClipCache] Open failed:', error);
      });
    }
    return this.ready;
  }

  private async open(): Promise<void> {
    const dir = this.dir;
    if (!dir) return;
    await FileSystem.makeDirectoryAsync(dir, {intermediates: true}).catch(
      ignoreError,
    );
    let saved: Record<string, CachedClipEntry> = {};
    try {
      const raw = await AsyncStorage.getItem(MOMENTS_CACHE_INDEX_KEY);
      if (raw) saved = JSON.parse(raw) as Record<string, CachedClipEntry>;
    } catch {
      saved = {};
    }
    const files = await FileSystem.readDirectoryAsync(dir);
    const onDisk = new Set(files);
    for (const file of files) {
      if (!saved[file]) {
        // A partial download, or a file the index lost track of.
        await FileSystem.deleteAsync(`${dir}${file}`, {idempotent: true});
      }
    }
    this.entries.clear();
    for (const [name, entry] of Object.entries(saved)) {
      if (onDisk.has(name) && typeof entry?.size === 'number') {
        this.entries.set(name, {...entry, fileName: name});
      }
    }
    await this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        MOMENTS_CACHE_INDEX_KEY,
        JSON.stringify(Object.fromEntries(this.entries)),
      );
    } catch {
      // The folder is reconciled again on the next launch.
    }
  }

  /** The local file for a clip when it is fully downloaded, else null. */
  getLocalUri(request: ClipRequest): string | null {
    const dir = this.dir;
    if (!dir) return null;
    const name = clipFileName(request.id, request.url);
    return this.entries.has(name) ? `${dir}${name}` : null;
  }

  /** Marks a clip as just played, for least-recently-played eviction. */
  markPlayed(request: ClipRequest): void {
    const name = clipFileName(request.id, request.url);
    const entry = this.entries.get(name);
    if (!entry) return;
    entry.lastUsedAt = this.now();
    void this.persist();
  }

  /**
   * Downloads the given clips in order (nearest card first), replacing any
   * downloads still waiting from an earlier call. `keep` are clips that must
   * not be evicted to make room (the card on screen and those around it).
   */
  prefetch(requests: ClipRequest[], keep: ClipRequest[] = requests): void {
    this.protectedNames = new Set(
      [...keep, ...requests].map(r => clipFileName(r.id, r.url)),
    );
    this.queue = requests.filter(
      r => !this.entries.has(clipFileName(r.id, r.url)),
    );
    void this.drain();
  }

  /** Resolves once nothing is downloading or waiting (tests). */
  async idle(): Promise<void> {
    await this.init();
    while (this.downloading || this.queue.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  private async drain(): Promise<void> {
    await this.init();
    if (this.downloading) return;
    while (this.queue.length) {
      const request = this.queue.shift()!;
      const name = clipFileName(request.id, request.url);
      if (this.entries.has(name)) continue;
      this.downloading = name;
      try {
        await this.download(request, name);
      } catch (error) {
        if (__DEV__) console.warn('[MomentsClipCache] Download failed:', error);
      } finally {
        this.downloading = null;
      }
    }
  }

  private async download(request: ClipRequest, name: string): Promise<void> {
    const dir = this.dir;
    if (!dir) return;
    const generation = this.generation;
    const partial = `${dir}${name}${PARTIAL_SUFFIX}`;
    const target = `${dir}${name}`;
    try {
      const result = await FileSystem.downloadAsync(request.url, partial);
      if (result.status !== 200) throw new Error(`HTTP ${result.status}`);
      if (generation !== this.generation) return;
      await FileSystem.moveAsync({from: partial, to: target});
      const info = await FileSystem.getInfoAsync(target);
      const size = info.exists ? info.size : 0;
      this.entries.set(name, {fileName: name, size, lastUsedAt: this.now()});
      await this.evict();
    } finally {
      await FileSystem.deleteAsync(partial, {idempotent: true}).catch(
        ignoreError,
      );
    }
  }

  private async evict(): Promise<void> {
    const dir = this.dir;
    if (!dir) return;
    const names = planEviction(
      [...this.entries.values()],
      this.capBytes,
      this.protectedNames,
    );
    for (const name of names) {
      this.entries.delete(name);
      await FileSystem.deleteAsync(`${dir}${name}`, {idempotent: true}).catch(
        ignoreError,
      );
    }
    await this.persist();
  }

  /** Bytes the cached clips take on disk. */
  async getSize(): Promise<number> {
    await this.init();
    const dir = this.dir;
    if (!dir) return 0;
    try {
      const files = await FileSystem.readDirectoryAsync(dir);
      let total = 0;
      for (const file of files) {
        const info = await FileSystem.getInfoAsync(`${dir}${file}`);
        if (info.exists && !info.isDirectory) total += info.size;
      }
      return total;
    } catch {
      return 0;
    }
  }

  /** Deletes every cached clip and any download in progress. */
  async clear(): Promise<void> {
    await this.init();
    this.generation++;
    this.queue = [];
    this.entries.clear();
    const dir = this.dir;
    if (dir) {
      await FileSystem.deleteAsync(dir, {idempotent: true});
      await FileSystem.makeDirectoryAsync(dir, {intermediates: true}).catch(
        ignoreError,
      );
    }
    await this.persist();
  }
}

export const momentsClipCache = new MomentsClipCache();

/** Bytes the Moments clip cache takes on disk (for the Storage screen). */
export function getMomentsCacheSize(): Promise<number> {
  return momentsClipCache.getSize();
}

/** Deletes every cached Moments clip (for the Storage screen). */
export function clearMomentsCache(): Promise<void> {
  return momentsClipCache.clear();
}
// @ai-end
