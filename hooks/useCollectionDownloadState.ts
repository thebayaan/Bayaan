import {useMemo} from 'react';
import {useDownload} from '@/services/player/store/downloadStore';

interface CollectionItem {
  reciter: {id: string} | null;
  surah: {id: number} | null;
  track: {
    reciterId: string;
    surahId: string;
    rewayatId?: string;
  };
}

interface DownloadState {
  allDownloaded: boolean;
  hasNoTracks: boolean;
  totalTracks: number;
  downloadedCount: number;
}

/**
 * Custom hook to calculate download state for a collection of tracks
 * Abstracts the business logic from UI components
 *
 * @param items - Array of collection items (loved tracks, playlist items, etc.)
 * @returns Download state including whether all tracks are downloaded, if collection is empty, and counts
 */
export function useCollectionDownloadState(
  items: CollectionItem[],
): DownloadState {
  const {isDownloaded, isDownloadedWithRewayat} = useDownload();

  return useMemo(() => {
    // Empty collection
    if (items.length === 0) {
      return {
        allDownloaded: false,
        hasNoTracks: true,
        totalTracks: 0,
        downloadedCount: 0,
      };
    }

    // Count valid tracks and downloaded tracks
    let validTrackCount = 0;
    let downloadedCount = 0;

    items.forEach(item => {
      // Skip invalid items
      if (!item.reciter || !item.surah) return;

      validTrackCount++;

      // Check if downloaded (with or without rewayatId)
      const isTrackDownloaded = item.track.rewayatId
        ? isDownloadedWithRewayat(
            item.track.reciterId,
            item.track.surahId,
            item.track.rewayatId,
          )
        : isDownloaded(item.track.reciterId, item.track.surahId);

      if (isTrackDownloaded) {
        downloadedCount++;
      }
    });

    // All tracks are downloaded if downloaded count equals valid track count
    const allDownloaded =
      validTrackCount > 0 && downloadedCount === validTrackCount;

    return {
      allDownloaded,
      hasNoTracks: validTrackCount === 0,
      totalTracks: validTrackCount,
      downloadedCount,
    };
  }, [items, isDownloaded, isDownloadedWithRewayat]);
}
