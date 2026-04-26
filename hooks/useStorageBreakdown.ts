import {useState, useEffect} from 'react';
import {
  getDownloadsStorage,
  getCacheStorage,
  getDeviceStorage,
  formatBytes,
} from '@/services/storageService';

export function useStorageBreakdown() {
  const [data, setData] = useState({
    total: '0 Bytes',
    free: '0 Bytes',
    used: '0 Bytes',
    downloads: '0 Bytes',
    cache: '0 Bytes',
    otherApps: '0 Bytes',
  });
  const [rawData, setRawData] = useState({
    total: 0,
    free: 0,
    used: 0,
    downloads: 0,
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
        const downloadsSize = getDownloadsStorage();
        console.log('[Storage] Downloads size:', downloadsSize, 'bytes');

        // Get cache storage
        const cacheSize = await getCacheStorage();
        console.log('[Storage] Cache size:', cacheSize, 'bytes');

        // Calculate breakdown:
        // Device used = total - free
        // Device used = other apps + our downloads + our cache
        // So: other apps = device used - our downloads - our cache
        const deviceUsed = deviceStorage.used;
        const otherAppsSize = deviceUsed - downloadsSize - cacheSize;

        // Update raw data (in bytes)
        setRawData({
          total: deviceStorage.total,
          free: deviceStorage.free,
          used: deviceUsed,
          downloads: downloadsSize,
          cache: cacheSize,
          otherApps: Math.max(0, otherAppsSize), // Ensure non-negative
        });

        // Update formatted data
        setData({
          total: formatBytes(deviceStorage.total),
          free: formatBytes(deviceStorage.free),
          used: formatBytes(deviceUsed),
          downloads: formatBytes(downloadsSize),
          cache: formatBytes(cacheSize),
          otherApps: formatBytes(Math.max(0, otherAppsSize)),
        });
      } catch (err) {
        console.error('Error loading storage info:', err);
        setError('Failed to load storage information');
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
