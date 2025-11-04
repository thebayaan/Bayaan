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
  // Check if the surah is downloaded (with rewayat if provided)
  const downloadStore = useDownloadStore.getState();
  
  // Use isDownloadedWithRewayat if rewayatId is provided, otherwise use isDownloaded
  const isDownloaded = rewayatId
    ? downloadStore.isDownloadedWithRewayat(reciter.id, surahId, rewayatId)
    : downloadStore.isDownloaded(reciter.id, surahId);
  
  if (isDownloaded) {
    const download = downloadStore.getDownload(reciter.id, surahId);
    // Double-check that the download matches the rewayat (if specified)
    if (
      download &&
      download.status === 'completed' &&
      (!rewayatId || download.rewayatId === rewayatId)
    ) {
      console.log(
        `Using local file for ${reciter.name} - Surah ${surahId}${rewayatId ? ` (Rewayat: ${rewayatId})` : ''}: ${download.filePath}`,
      );
      return download.filePath;
    }
  }
  
  // Fall back to remote URL if not downloaded
  console.log(
    `Using remote URL for ${reciter.name} - Surah ${surahId}${rewayatId ? ` (Rewayat: ${rewayatId})` : ''}`,
  );
  return generateAudioUrl(reciter, surahId, rewayatId);
}
