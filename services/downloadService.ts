import {Platform} from 'react-native'; // @ai
import * as FileSystem from 'expo-file-system/legacy';
import {useNetworkStore} from '@/store/networkStore'; // @ai
import {fetchAudioUrl} from './dataService';
import {DownloadedSurah} from './player/store/downloadStore';

interface DownloadResult {
  filePath: string; // This is now a RELATIVE path (just the filename)
  fileSize: number;
}

// @ai-start
/** Why a download did not finish, so callers can say the right thing. */
export type DownloadFailureReason = 'offline' | 'cancelled' | 'failed';

export class DownloadError extends Error {
  constructor(message: string, readonly reason: DownloadFailureReason) {
    super(message);
    this.name = 'DownloadError';
  }
}

export function downloadFailureReason(error: unknown): DownloadFailureReason {
  return error instanceof DownloadError ? error.reason : 'failed';
}

export interface DownloadSurahOptions {
  /**
   * Called once the download is under way, with a function that stops it.
   * A stopped download rejects with reason 'cancelled'.
   */
  onStart?: (cancel: () => void) => void;
}
// @ai-end

/**
 * Resolves a relative file path (filename) to an absolute path.
 * This is necessary because iOS changes the app container UUID on updates,
 * so we store only the filename and reconstruct the full path at runtime.
 * @param relativePath - The filename or relative path
 * @returns The full absolute path using the current documentDirectory
 */
export function resolveFilePath(relativePath: string): string {
  // If it's already an absolute path (legacy data), extract just the filename
  if (relativePath.startsWith('file://') || relativePath.startsWith('/')) {
    const filename = relativePath.split('/').pop() || relativePath;
    return `${FileSystem.documentDirectory}${filename}`;
  }
  // Otherwise, it's already a relative path (just filename)
  return `${FileSystem.documentDirectory}${relativePath}`;
}

/**
 * Extracts just the filename from a path (for migration purposes)
 * @param filePath - Full path or filename
 * @returns Just the filename
 */
export function extractFilename(filePath: string): string {
  if (filePath.startsWith('file://') || filePath.startsWith('/')) {
    return filePath.split('/').pop() || filePath;
  }
  return filePath;
}

// @ai-start
/**
 * A response header's value. iOS reports "Content-Length"; Android passes the
 * name through as the server sent it, which is lowercase over HTTP/2.
 */
function headerValue(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  const key = Object.keys(headers).find(k => k.toLowerCase() === wanted);
  return key === undefined ? undefined : headers[key];
}

/**
 * How many bytes the server said the file has, or null when it did not say.
 * A body compressed in transit is also null: the header then counts the
 * compressed bytes, and the file on disk is larger.
 */
function expectedBytes(
  headers: Record<string, string> | undefined,
): number | null {
  const encoding = headerValue(headers, 'content-encoding');
  if (encoding && encoding.trim().toLowerCase() !== 'identity') return null;
  const length = Number(headerValue(headers, 'content-length'));
  return Number.isFinite(length) && length > 0 ? length : null;
}

/**
 * iOS: the files of downloads that a killed launch left behind.
 *
 * A download runs in a background URLSession, and expo-file-system gives that
 * session a new identifier at each launch. When the app is killed during a
 * download, iOS still finishes it, but no later launch opens a session with
 * the old identifier, so nothing ever claims the file. It stays at
 * Library/Caches/com.apple.nsurlsessiond/Downloads/<bundle id>/
 * CFNetworkDownload_*.tmp, one full surah file for each kill, and "Clear
 * cache" leaves that folder alone because live downloads use it too.
 *
 * The sweep runs once in each launch, and every download waits for it, so it
 * can never delete the file of a download of this launch. A failed sweep
 * never stops a download.
 */
const SESSION_DOWNLOADS_DIR = 'com.apple.nsurlsessiond/Downloads/';
const ORPHANED_DOWNLOAD = /^CFNetworkDownload_.*\.tmp$/;
let orphanSweep: Promise<void> | null = null;

export function sweepOrphanedDownloads(): Promise<void> {
  orphanSweep ??= deleteOrphanedDownloads();
  return orphanSweep;
}

async function deleteOrphanedDownloads(): Promise<void> {
  if (Platform.OS !== 'ios' || !FileSystem.cacheDirectory) return;
  const root = `${FileSystem.cacheDirectory}${SESSION_DOWNLOADS_DIR}`;
  try {
    const info = await FileSystem.getInfoAsync(root);
    if (!info.exists || !info.isDirectory) return;
    // One folder for each bundle id; the app's own is the only one in its
    // container, but the name is not ours to guess.
    for (const folder of await FileSystem.readDirectoryAsync(root)) {
      const dir = `${root}${folder}/`;
      const entries = await FileSystem.readDirectoryAsync(dir).catch(
        () => [] as string[],
      );
      for (const entry of entries) {
        if (!ORPHANED_DOWNLOAD.test(entry)) continue;
        await FileSystem.deleteAsync(`${dir}${entry}`, {idempotent: true});
      }
    }
  } catch (error) {
    console.error('[DownloadService] Orphaned download sweep failed:', error);
  }
}

/** A download under way, and the way to stop it. */
interface Transfer {
  done: Promise<number>;
  cancel: () => void;
}

/**
 * Downloads to `<file>.part` and only renames it to the real name once the
 * whole file has arrived.
 *
 * Before this the download was written straight to the real name. Android
 * left the partial file there when the connection dropped or the app was
 * killed, and the next tap on Download found "the file", marked the surah
 * downloaded, and it cut off part-way on every play. On both platforms a
 * 404/403/5xx error page was saved as the .mp3 and marked downloaded.
 *
 * `done` resolves to the size of the file on disk, in bytes.
 */
function startTransfer(
  remoteUrl: string,
  localPath: string,
  onProgress?: (progress: number) => void,
): Transfer {
  const partPath = `${localPath}.part`;
  let cancelled = false;
  let task: FileSystem.DownloadResumable | null = null;
  let settleAsCancelled: (() => void) | null = null;

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    task?.cancelAsync().catch(() => undefined);
    // Do not wait for the native side to answer the cancel.
    settleAsCancelled?.();
  };

  const run = async (): Promise<number> => {
    await sweepOrphanedDownloads();
    // A killed app or an earlier failure can leave a partial file behind.
    await FileSystem.deleteAsync(partPath, {idempotent: true});

    try {
      if (cancelled) throw new DownloadError('Download cancelled', 'cancelled');

      // Use downloadResumable for progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        remoteUrl,
        partPath,
        {},
        onProgress
          ? downloadProgress => {
              const progress =
                downloadProgress.totalBytesWritten /
                downloadProgress.totalBytesExpectedToWrite;
              onProgress(progress);
            }
          : undefined,
      );
      task = downloadResumable;

      const result = await new Promise<
        FileSystem.FileSystemDownloadResult | undefined
      >((resolve, reject) => {
        settleAsCancelled = () => resolve(undefined);
        downloadResumable.downloadAsync().then(resolve, reject);
      });

      if (cancelled) throw new DownloadError('Download cancelled', 'cancelled');
      if (!result) {
        throw new Error('Download failed: no result returned');
      }
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`Download failed: HTTP ${result.status}`);
      }

      const info = await FileSystem.getInfoAsync(partPath);
      const size = info.exists ? info.size : 0;
      const expected = expectedBytes(result.headers);
      if (size <= 0 || (expected !== null && size !== expected)) {
        throw new Error(
          `Download incomplete: ${size} of ${expected ?? 'unknown'} bytes`,
        );
      }

      await FileSystem.moveAsync({from: partPath, to: localPath});
      return size;
    } catch (error) {
      await FileSystem.deleteAsync(partPath, {idempotent: true}).catch(
        () => undefined,
      );
      throw error;
    }
  };

  return {done: run(), cancel};
}

// Transfers under way, by destination. Two callers asking for the same file
// share one transfer: a second one would delete the first one's partial file
// from under it.
const transfers = new Map<string, Transfer>();

function downloadToFile(
  remoteUrl: string,
  localPath: string,
  onProgress?: (progress: number) => void,
): Transfer {
  const running = transfers.get(localPath);
  if (running) return running;
  const started = startTransfer(remoteUrl, localPath, onProgress);
  const transfer: Transfer = {
    done: started.done.finally(() => transfers.delete(localPath)),
    cancel: started.cancel,
  };
  transfers.set(localPath, transfer);
  return transfer;
}
// @ai-end

/**
 * Downloads a Surah MP3 for offline playback
 * @param surahId - The Surah number (1-114)
 * @param reciterId - The reciter's unique identifier
 * @param rewayatId - Optional: the rewayat ID (reading style)
 * @param onProgress - Optional: callback for download progress (0-1)
 * @param options - Optional: `onStart` hands back a way to stop the download
 * @returns Promise resolving to download result with file path and size
 * @throws {DownloadError} When the download fails, is stopped, or cannot
 *   start offline; `reason` says which. Invalid parameters throw a plain Error.
 */
export async function downloadSurah(
  surahId: number,
  reciterId: string,
  rewayatId?: string,
  onProgress?: (progress: number) => void,
  options?: DownloadSurahOptions, // @ai
): Promise<DownloadResult> {
  // Validate inputs
  if (!surahId || surahId < 1 || surahId > 114) {
    throw new Error(`Invalid surah ID: ${surahId}. Must be between 1 and 114.`);
  }

  if (!reciterId || typeof reciterId !== 'string') {
    throw new Error('Invalid reciter ID provided');
  }

  // Sanitize file name components to prevent path injection
  const sanitizedReciterId = reciterId.replace(/[^a-zA-Z0-9_-]/g, '');
  const sanitizedRewayatId = rewayatId?.replace(/[^a-zA-Z0-9_-]/g, '');

  try {
    // @ai-start
    // iOS hands the download to a background URLSession, which waits for a
    // connection instead of failing: one started offline sat at 0% for good,
    // with no error and no way to stop it. Only having no network at all
    // stops it here, not a failed internet check: that check asks a Google
    // URL, which some networks block while the audio server works. Android
    // is left to try. It fails by itself within seconds, and its "network
    // validated" flag can read offline on networks that do work.
    if (Platform.OS === 'ios' && !useNetworkStore.getState().isConnected) {
      throw new DownloadError('No internet connection', 'offline');
    }
    // @ai-end

    // Get the remote URL using the data service
    const remoteUrl = await fetchAudioUrl(surahId, reciterId, rewayatId);

    // Generate safe file name
    const padded = surahId.toString().padStart(3, '0');
    const fileName = sanitizedRewayatId
      ? `${padded}_${sanitizedReciterId}_${sanitizedRewayatId}.mp3`
      : `${padded}_${sanitizedReciterId}.mp3`;
    const localPath = `${FileSystem.documentDirectory}${fileName}`;

    console.log(`Downloading Surah ${surahId}...`);

    // @ai-start
    // A file already at this name is not trusted. Callers only get here when
    // the surah has no download record, and a file without a record is what
    // an interrupted Android download left behind. It is downloaded again
    // and replaced only once the new copy is complete.
    //
    // The size comes from the file itself: the Content-Length lookup missed
    // on Android (lowercase header name) and recorded 0, which made
    // Settings > Storage show "Downloads: 0 bytes".
    const transfer = downloadToFile(remoteUrl, localPath, onProgress);
    options?.onStart?.(transfer.cancel);
    const fileSize = await transfer.done;
    // @ai-end

    console.log('Download complete:', localPath, `Size: ${fileSize} bytes`);

    // Return only the filename (relative path) for storage
    // This ensures paths remain valid after app updates on iOS
    return {
      filePath: fileName,
      fileSize,
    };
  } catch (error) {
    // @ai-start
    // Being offline or stopped by the user is not an error worth reporting.
    const reason = downloadFailureReason(error);
    if (reason === 'failed') console.error('Download failed:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new DownloadError(
      `Failed to download Surah ${surahId}: ${errorMessage}`,
      reason,
    );
    // @ai-end
  }
}

export async function clearAllDownloads(
  downloads: DownloadedSurah[],
): Promise<void> {
  const errors: string[] = [];

  // Delete all files in parallel for better performance
  const deletePromises = downloads.map(async download => {
    try {
      // Resolve the relative path to absolute path
      const absolutePath = resolveFilePath(download.filePath);
      const fileInfo = await FileSystem.getInfoAsync(absolutePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(absolutePath);
        console.log('Deleted file:', absolutePath);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      const errorMsg = `Failed to delete ${download.filePath}: ${errorMessage}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  });

  // Wait for all deletions to complete
  await Promise.all(deletePromises);

  // If any deletions failed, throw an error with details
  if (errors.length > 0) {
    throw new Error(
      `Failed to delete ${errors.length} files:\n${errors.join('\n')}`,
    );
  }
}

export async function removeDownload(download: DownloadedSurah): Promise<void> {
  try {
    // Resolve the relative path to absolute path
    const absolutePath = resolveFilePath(download.filePath);
    const fileInfo = await FileSystem.getInfoAsync(absolutePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(absolutePath);
      console.log('Deleted file:', absolutePath);
    }
  } catch (error) {
    console.error('Error deleting file:', download.filePath, error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(
      `Failed to delete file ${download.filePath}: ${errorMessage}`,
    );
  }
}
