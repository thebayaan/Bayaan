import * as FileSystem from 'expo-file-system/legacy';
import {fetchAudioUrl} from './dataService';
import {DownloadedSurah} from './player/store/downloadStore';

interface DownloadResult {
  filePath: string; // This is now a RELATIVE path (just the filename)
  fileSize: number;
}

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
 * Downloads to `<file>.part` and only renames it to the real name once the
 * whole file has arrived.
 *
 * Before this the download was written straight to the real name. Android
 * left the partial file there when the connection dropped or the app was
 * killed, and the next tap on Download found "the file", marked the surah
 * downloaded, and it cut off part-way on every play. On both platforms a
 * 404/403/5xx error page was saved as the .mp3 and marked downloaded.
 * @returns The size of the file on disk, in bytes
 */
async function transferToFile(
  remoteUrl: string,
  localPath: string,
  onProgress?: (progress: number) => void,
): Promise<number> {
  const partPath = `${localPath}.part`;
  // A killed app or an earlier failure can leave a partial file behind.
  await FileSystem.deleteAsync(partPath, {idempotent: true});

  try {
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

    const result = await downloadResumable.downloadAsync();

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
}

// Transfers under way, by destination. Two callers asking for the same file
// share one transfer: a second one would delete the first one's partial file
// from under it.
const transfers = new Map<string, Promise<number>>();

function downloadToFile(
  remoteUrl: string,
  localPath: string,
  onProgress?: (progress: number) => void,
): Promise<number> {
  const running = transfers.get(localPath);
  if (running) return running;
  const transfer = transferToFile(remoteUrl, localPath, onProgress).finally(
    () => transfers.delete(localPath),
  );
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
 * @returns Promise resolving to download result with file path and size
 * @throws {Error} When download fails or invalid parameters provided
 */
export async function downloadSurah(
  surahId: number,
  reciterId: string,
  rewayatId?: string,
  onProgress?: (progress: number) => void,
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
    const fileSize = await downloadToFile(remoteUrl, localPath, onProgress);
    // @ai-end

    console.log('Download complete:', localPath, `Size: ${fileSize} bytes`);

    // Return only the filename (relative path) for storage
    // This ensures paths remain valid after app updates on iOS
    return {
      filePath: fileName,
      fileSize,
    };
  } catch (error) {
    console.error('Download failed:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to download Surah ${surahId}: ${errorMessage}`);
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
