import {useState, useEffect} from 'react';
// @ai-start
import i18n from '@/i18n';
// @ai-end
import {
  getDownloadsStorage,
  getCacheStorage,
  getDeviceStorage,
  formatBytes,
} from '@/services/storageService';
import {uploadsService} from '@/services/uploads/UploadsService'; // @ai

// @ai-start
export function useStorageBreakdown() {
  const [data, setData] = useState(() => {
    const zero = formatBytes(0);
    return {
      total: zero,
      free: zero,
      used: zero,
      downloads: zero,
      uploads: zero,
      cache: zero,
      otherApps: zero,
    };
  });
  const [rawData, setRawData] = useState({
    total: 0,
    free: 0,
    used: 0,
    downloads: 0,
    uploads: 0,
    cache: 0,
    otherApps: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function loadStorageInfo() {
      try {
        setLoading(true);
        setError(null);

        // Get device storage (total capacity and free space)
        const deviceStorage = await getDeviceStorage();

        // Get downloads storage
        const downloadsSize = await getDownloadsStorage();
        console.log('[Storage] Downloads size:', downloadsSize, 'bytes');

        // Get cache storage
        const cacheSize = await getCacheStorage();
        console.log('[Storage] Cache size:', cacheSize, 'bytes');

        // The user's imported audio. It had no row of its own and was
        // counted under "Other apps". A failure here must not hide the rest
        // of the screen.
        const uploadsSize = await uploadsService
          .getTotalStorageSize()
          .catch(() => 0);

        // Calculate breakdown:
        // Device used = total - free
        // Device used = other apps + our downloads + our uploads + our cache
        // So: other apps = device used - our downloads - uploads - cache
        const deviceUsed = deviceStorage.used;
        const otherAppsSize =
          deviceUsed - downloadsSize - uploadsSize - cacheSize;

        // Update raw data (in bytes)
        setRawData({
          total: deviceStorage.total,
          free: deviceStorage.free,
          used: deviceUsed,
          downloads: downloadsSize,
          uploads: uploadsSize,
          cache: cacheSize,
          otherApps: Math.max(0, otherAppsSize), // Ensure non-negative
        });

        // Update formatted data
        setData({
          total: formatBytes(deviceStorage.total),
          free: formatBytes(deviceStorage.free),
          used: formatBytes(deviceUsed),
          downloads: formatBytes(downloadsSize),
          uploads: formatBytes(uploadsSize),
          cache: formatBytes(cacheSize),
          otherApps: formatBytes(Math.max(0, otherAppsSize)),
        });
      } catch (err) {
        console.error('Error loading storage info:', err);
        setError(i18n.t('content:errors.storageLoadFailed'));
      } finally {
        setLoading(false);
      }
    }

    loadStorageInfo();
  }, [refreshKey]);

  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return {
    ...data,
    rawData, // Include raw bytes for calculations if needed
    loading,
    error,
    refresh,
  };
}
// @ai-end
