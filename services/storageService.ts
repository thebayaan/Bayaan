import DeviceInfo from 'react-native-device-info';
import * as FileSystem from 'expo-file-system/legacy';
// @ai-start
import i18n from '@/i18n';
import {decimalSeparator} from '@/i18n/format';
// @ai-end
import {useDownloadStore} from './player/store/downloadStore';
import {resolveFilePath} from './downloadService'; // @ai

// @ai-start
export async function getDownloadsStorage(): Promise<number> {
  const downloads = useDownloadStore.getState().downloads;
  console.log('[StorageService] Total downloads:', downloads.length);
  // Downloads saved by earlier Android builds were recorded with size 0 (the
  // length header was looked up under the wrong case), which showed as
  // "Downloads: 0 bytes". For those, read the size from the file.
  const sizes = await Promise.all(
    downloads.map(async download => {
      if (download.fileSize) return download.fileSize;
      try {
        const info = await FileSystem.getInfoAsync(
          resolveFilePath(download.filePath),
        );
        return info.exists ? info.size || 0 : 0;
      } catch {
        return 0;
      }
    }),
  );
  const totalSize = sizes.reduce((total, size) => total + size, 0);
  console.log('[StorageService] Total downloads size:', totalSize, 'bytes');
  return totalSize;
}
// @ai-end

// @ai-start
// Folders in the cache directory that are in use while the app runs, so
// "Clear cache" leaves them alone:
// - com.apple.nsurlsessiond: where iOS keeps downloads that are in flight.
//   Deleting it fails every surah being downloaded.
// - io.sentry (iOS), sentry (Android): crash reports not sent yet.
// - bayaan-car: CarPlay and Android Auto artwork. iOS makes the folder only
//   at launch, so once deleted no artwork was saved to disk until relaunch.
const IN_USE_CACHE_ENTRIES = new Set([
  'com.apple.nsurlsessiond',
  'io.sentry',
  'sentry',
  'bayaan-car',
]);
// @ai-end

export async function getCacheStorage(): Promise<number> {
  let totalSize = 0;

  if (!FileSystem.cacheDirectory) {
    return 0;
  }

  try {
    const files = await FileSystem.readDirectoryAsync(
      FileSystem.cacheDirectory,
    );
    for (const file of files) {
      // @ai-start
      // What "Clear cache" leaves alone is not counted either.
      if (IN_USE_CACHE_ENTRIES.has(file)) continue;
      const filePath = `${FileSystem.cacheDirectory}${file}`;
      const info = await FileSystem.getInfoAsync(filePath);
      // Folders count too: for a folder, `size` is everything inside it.
      // They were skipped, and nearly all of the cache (picker copies of
      // imported audio, the image cache) sits in folders, so the figure
      // barely moved whatever was cached.
      if (info.exists) {
        totalSize += info.size || 0;
      }
      // @ai-end
    }
    console.log('[StorageService] Cache size calculated:', totalSize, 'bytes');
  } catch (error) {
    console.error('Error calculating cache size:', error);
  }

  return totalSize;
}

export async function clearCacheDirectory(): Promise<void> {
  if (!FileSystem.cacheDirectory) {
    console.log('[StorageService] No cache directory to clear');
    return;
  }

  try {
    console.log(
      '[StorageService] Clearing cache directory:',
      FileSystem.cacheDirectory,
    );
    const files = await FileSystem.readDirectoryAsync(
      FileSystem.cacheDirectory,
    );

    for (const file of files) {
      if (IN_USE_CACHE_ENTRIES.has(file)) continue; // @ai
      const filePath = `${FileSystem.cacheDirectory}${file}`;
      const info = await FileSystem.getInfoAsync(filePath);

      if (info.exists) {
        try {
          if (info.isDirectory) {
            // Delete directory recursively
            await FileSystem.deleteAsync(filePath, {idempotent: true});
            console.log('[StorageService] Deleted directory:', filePath);
          } else {
            // Delete file (idempotent means "safe to delete even if already deleted")
            await FileSystem.deleteAsync(filePath, {idempotent: true});
            console.log('[StorageService] Deleted file:', filePath);
          }
        } catch (deleteError) {
          console.error(
            '[StorageService] Error deleting:',
            filePath,
            deleteError,
          );
        }
      }
    }

    console.log('[StorageService] Cache directory cleared successfully');
  } catch (error) {
    console.error('[StorageService] Error clearing cache directory:', error);
    throw error;
  }
}

export async function getDeviceStorage(): Promise<{
  total: number;
  free: number;
  used: number;
}> {
  const total = await DeviceInfo.getTotalDiskCapacity();
  const free = await DeviceInfo.getFreeDiskStorage();
  const used = total - free;

  return {total, free, used};
}

// @ai-start
export function formatBytes(bytes: number): string {
  if (bytes === 0) return i18n.t('content:units.bytes', {value: 0});

  const k = 1024;
  const units = ['bytes', 'kb', 'mb', 'gb'] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const amount = String(Math.round((bytes / Math.pow(k, i)) * 100) / 100);
  const value = amount.replace('.', decimalSeparator());

  return i18n.t(`content:units.${units[i]}`, {value});
}
// @ai-end
