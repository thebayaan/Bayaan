// @ai-start
import type {DownloadedSurah} from './store/downloadStore';

/**
 * A single surah to download as part of a bulk operation.
 */
export interface BulkDownloadItem {
  surahId: number;
  reciterId: string;
  /** Optional rewayah. When provided, downloads are tracked per-rewayah. */
  rewayatId?: string;
}

/**
 * Side-effecting dependencies injected into {@link bulkDownloadSurahs}.
 *
 * Injecting these (rather than importing the download service and store
 * directly) keeps this module free of expo/React Native imports, which makes
 * the bulk-download logic unit-testable in isolation.
 */
export interface BulkDownloadDeps {
  downloadSurah: (
    surahId: number,
    reciterId: string,
    rewayatId: string | undefined,
    onProgress?: (progress: number) => void,
  ) => Promise<{filePath: string; fileSize: number}>;
  isDownloaded: (reciterId: string, surahId: string) => boolean;
  isDownloadedWithRewayat: (
    reciterId: string,
    surahId: string,
    rewayatId: string,
  ) => boolean;
  isDownloading: (reciterId: string, surahId: string) => boolean;
  isDownloadingWithRewayat: (
    reciterId: string,
    surahId: string,
    rewayatId: string,
  ) => boolean;
  setDownloading: (id: string) => void;
  clearDownloading: (id: string) => void;
  addDownload: (download: DownloadedSurah) => void;
  setDownloadProgress: (id: string, progress: number) => void;
}

export interface BulkDownloadCallbacks {
  /** Reports how many pending items have finished out of the pending total. */
  onProgress?: (completed: number, total: number) => void;
  /** Polled before each download; return true to stop the batch gracefully. */
  isCancelled?: () => boolean;
  /** Delay between downloads (ms) to avoid AsyncStorage write storms. */
  interDownloadDelayMs?: number;
  /** Minimum gap (ms) between per-item progress writes to the store. */
  progressThrottleMs?: number;
}

export interface BulkDownloadSummary {
  /** Total items requested. */
  total: number;
  /** Items newly downloaded in this run. */
  downloaded: number;
  /** Items skipped because they were already downloaded. */
  skipped: number;
  /** Items that errored (the batch continues past failures). */
  failed: number;
  /** Whether the run was stopped early via the cancellation hook. */
  cancelled: boolean;
}

const DEFAULT_INTER_DOWNLOAD_DELAY_MS = 100;
const DEFAULT_PROGRESS_THROTTLE_MS = 300;

/**
 * Builds the download-tracking ID for a surah. This MUST match the format used
 * by `SurahItem` (`${reciterId}-${surahId}` or `${reciterId}-${surahId}-${rewayatId}`)
 * so per-row progress rings and downloaded checkmarks update during the batch.
 */
export function buildDownloadId(item: BulkDownloadItem): string {
  return item.rewayatId
    ? `${item.reciterId}-${item.surahId}-${item.rewayatId}`
    : `${item.reciterId}-${item.surahId}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Downloads a list of surahs sequentially for offline playback.
 *
 * Mirrors the proven bulk-download flow used elsewhere in the app: it skips
 * items that are already downloaded or currently in-flight, throttles progress
 * writes, spaces downloads out to avoid overwhelming persistence, and isolates
 * per-item failures so a single bad download does not abort the whole batch.
 */
export async function bulkDownloadSurahs(
  items: BulkDownloadItem[],
  deps: BulkDownloadDeps,
  callbacks: BulkDownloadCallbacks = {},
): Promise<BulkDownloadSummary> {
  const {
    onProgress,
    isCancelled,
    interDownloadDelayMs = DEFAULT_INTER_DOWNLOAD_DELAY_MS,
    progressThrottleMs = DEFAULT_PROGRESS_THROTTLE_MS,
  } = callbacks;

  const total = items.length;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const pending = items.filter(item => {
    const surahIdStr = item.surahId.toString();
    const already = item.rewayatId
      ? deps.isDownloadedWithRewayat(item.reciterId, surahIdStr, item.rewayatId)
      : deps.isDownloaded(item.reciterId, surahIdStr);
    if (already) skipped += 1;
    return !already;
  });

  const pendingTotal = pending.length;
  onProgress?.(0, pendingTotal);

  let cancelled = false;
  let lastProgressUpdate = 0;

  for (let index = 0; index < pending.length; index++) {
    if (isCancelled?.()) {
      cancelled = true;
      break;
    }

    const item = pending[index];
    const surahIdStr = item.surahId.toString();
    const downloadId = buildDownloadId(item);

    const inFlight = item.rewayatId
      ? deps.isDownloadingWithRewayat(
          item.reciterId,
          surahIdStr,
          item.rewayatId,
        )
      : deps.isDownloading(item.reciterId, surahIdStr);

    if (inFlight) {
      onProgress?.(index + 1, pendingTotal);
      continue;
    }

    try {
      deps.setDownloading(downloadId);

      const result = await deps.downloadSurah(
        item.surahId,
        item.reciterId,
        item.rewayatId,
        progress => {
          const now = Date.now();
          if (now - lastProgressUpdate < progressThrottleMs) return;
          lastProgressUpdate = now;
          deps.setDownloadProgress(downloadId, progress);
        },
      );

      deps.addDownload({
        reciterId: item.reciterId,
        surahId: surahIdStr,
        rewayatId: item.rewayatId ?? '',
        filePath: result.filePath,
        fileSize: result.fileSize,
        downloadDate: Date.now(),
        status: 'completed',
      });

      downloaded += 1;
    } catch (error) {
      failed += 1;
      console.error(`Bulk download failed for surah ${item.surahId}:`, error);
    } finally {
      deps.clearDownloading(downloadId);
    }

    onProgress?.(index + 1, pendingTotal);

    const isLast = index === pending.length - 1;
    if (!isLast && interDownloadDelayMs > 0 && !isCancelled?.()) {
      await delay(interDownloadDelayMs);
    }
  }

  return {total, downloaded, skipped, failed, cancelled};
}
// @ai-end
