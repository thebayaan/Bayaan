import {Reciter} from '@/data/reciterData';
import {useDownloadStore} from '@/services/player/store/downloadStore';

export function generateAudioUrl(
  reciter: Reciter,
  surahId: string,
  rewayatId?: string,
): string {
  const paddedSurahId = surahId.padStart(3, '0');

  // Get the rewayat - either specified or default to first one
  const rewayat = rewayatId
    ? reciter.rewayat.find(r => r.id === rewayatId)
    : reciter.rewayat[0];

  if (!rewayat) {
    throw new Error('No rewayat found for reciter');
  }

  // Handle local file system paths (custom reciters)
  if (rewayat.server.startsWith('file://')) {
    const extension = rewayat.fileExtension || 'mp3';
    return `${rewayat.server}/${paddedSurahId}.${extension}`;
  }

  // If the server URL is a Supabase storage URL
  if (rewayat.server.includes('supabase.co')) {
    return `${rewayat.server}/${paddedSurahId}.mp3`;
  }

  // Default mp3quran.net URL
  return `${rewayat.server}/${paddedSurahId}.mp3`;
}

/**
 * Generates an audio URL that prefers local downloaded files over remote URLs
 * @param reciter - Reciter object
 * @param surahId - Surah ID as string
 * @param rewayatId - Optional specific rewayat ID
 * @returns Local file path if downloaded, otherwise remote URL
 */
export function generateSmartAudioUrl(
  reciter: Reciter,
  surahId: string,
  rewayatId?: string,
): string {
  // Check if the surah is downloaded
  const downloadStore = useDownloadStore.getState();
  const isDownloaded = downloadStore.isDownloaded(reciter.id, surahId);

  if (isDownloaded) {
    const download = downloadStore.getDownload(reciter.id, surahId);
    if (download && download.status === 'completed') {
      console.log(
        `Using local file for ${reciter.name} - Surah ${surahId}: ${download.filePath}`,
      );
      return download.filePath;
    }
  }

  // Fall back to remote URL if not downloaded
  console.log(`Using remote URL for ${reciter.name} - Surah ${surahId}`);
  return generateAudioUrl(reciter, surahId, rewayatId);
}
