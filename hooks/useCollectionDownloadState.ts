import {useMemo} from 'react';
import {useDownloads} from '@/services/player/store/downloadSelectors'; // @ai
import {downloadRewayatForPlayback} from '@/services/player/store/downloadStore';

interface CollectionItem {
  reciter: {id: string} | null;
  surah: {id: number} | null;
  track: {
    reciterId: string;
    surahId: string;
    rewayatId?: string;
    userRecitationId?: string; // @ai
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
  // @ai-start
  // Read the downloads themselves. This used to call the store's
  // isDownloaded functions, whose references never change, so the result
  // was computed once: the menu still said "Download all" after a batch
  // finished, and stayed on "All downloaded" (disabled) after removals.
  const downloads = useDownloads();
  // @ai-end

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

    // @ai-start
    // Same rule as the store's isDownloadedForPlayback: a completed record
    // for this reciter, surah and rewayah ('' for none), or, for the
    // reciter's first rewayah, one recorded without a rewayah.
    const key = (reciterId: string, surahId: string, rewayatId?: string) =>
      `${reciterId}|${surahId}|${rewayatId || ''}`;
    const completed = new Set<string>();
    downloads.forEach(download => {
      if (download.status === 'completed') {
        completed.add(
          key(download.reciterId, download.surahId, download.rewayatId),
        );
      }
    });
    // @ai-end

    // Count valid tracks and downloaded tracks
    let validTrackCount = 0;
    let downloadedCount = 0;

    items.forEach(item => {
      // Skip invalid items
      if (!item.reciter || !item.surah) return;
      // @ai-start
      // The user's own uploads are already on the device and cannot be
      // downloaded; counting them kept "All downloaded" out of reach.
      if (item.track.userRecitationId) return;
      // @ai-end

      validTrackCount++;

      // @ai-start
      // Check if downloaded (with or without rewayatId)
      const {reciterId, surahId, rewayatId} = item.track;
      const isTrackDownloaded = downloadRewayatForPlayback(
        reciterId,
        rewayatId,
      ).some(downloadRewayatId =>
        completed.has(key(reciterId, surahId, downloadRewayatId)),
      );
      // @ai-end

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
  }, [items, downloads]); // @ai
}
