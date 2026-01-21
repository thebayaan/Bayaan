import {Reciter} from '@/data/reciterData';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {resolveFilePath} from '@/services/downloadService';

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
  const downloadStore = useDownloadStore.getState();

  // Check if downloaded with specific rewayat
  if (rewayatId) {
    const download = downloadStore.getDownloadWithRewayat(
      reciter.id,
      surahId,
      rewayatId,
    );
    if (download) {
      // Resolve the relative path to absolute path at runtime
      // This ensures paths remain valid after iOS app updates
      const absolutePath = resolveFilePath(download.filePath);
      console.log(
        `Using local file for ${reciter.name} - Surah ${surahId} (Rewayat: ${rewayatId}): ${absolutePath}`,
      );
      return absolutePath;
    }
  } else {
    // Check without rewayat (legacy downloads without rewayatId)
    const download = downloadStore.getDownload(reciter.id, surahId);
    if (download && download.status === 'completed') {
      const absolutePath = resolveFilePath(download.filePath);
      console.log(
        `Using local file for ${reciter.name} - Surah ${surahId}: ${absolutePath}`,
      );
      return absolutePath;
    }
  }

  // Fall back to remote URL if not downloaded
  console.log(
    `Using remote URL for ${reciter.name} - Surah ${surahId}${
      rewayatId ? ` (Rewayat: ${rewayatId})` : ''
    }`,
  );
  return generateAudioUrl(reciter, surahId, rewayatId);
}
