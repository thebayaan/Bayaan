import DeviceInfo from 'react-native-device-info';
import * as FileSystem from 'expo-file-system/legacy';
import {useDownloadStore} from './player/store/downloadStore';

export function getDownloadsStorage(): number {
  const downloads = useDownloadStore.getState().downloads;
  console.log('[StorageService] Total downloads:', downloads.length);
  const totalSize = downloads.reduce((total, download) => {
    return total + (download.fileSize || 0);
  }, 0);
  console.log('[StorageService] Total downloads size:', totalSize, 'bytes');
  return totalSize;
}

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
      const filePath = `${FileSystem.cacheDirectory}${file}`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists && !info.isDirectory) {
        totalSize += info.size || 0;
      }
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

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
