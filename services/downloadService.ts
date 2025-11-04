import * as FileSystem from 'expo-file-system';
import {fetchAudioUrl} from './dataService';
import {DownloadedSurah} from './player/store/downloadStore';

interface DownloadResult {
  filePath: string;
  fileSize: number;
}

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

    // Check if file already exists
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      console.log('File already exists:', localPath);
      return {
        filePath: localPath,
        fileSize: fileInfo.size || 0,
      };
    }

    console.log(`Downloading Surah ${surahId}...`);

    // Use downloadResumable for progress tracking
    const downloadResumable = FileSystem.createDownloadResumable(
      remoteUrl,
      localPath,
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

    const fileSize = result.headers['Content-Length']
      ? parseInt(result.headers['Content-Length'], 10)
      : 0;

    console.log('Download complete:', localPath, `Size: ${fileSize} bytes`);

    return {
      filePath: localPath,
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

  // Delete all files
  for (const download of downloads) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(download.filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(download.filePath);
        console.log('Deleted file:', download.filePath);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      const errorMsg = `Failed to delete ${download.filePath}: ${errorMessage}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  // If any deletions failed, throw an error with details
  if (errors.length > 0) {
    throw new Error(
      `Failed to delete ${errors.length} files:\n${errors.join('\n')}`,
    );
  }
}

export async function removeDownload(download: DownloadedSurah): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(download.filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(download.filePath);
      console.log('Deleted file:', download.filePath);
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
