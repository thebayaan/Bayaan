import {Reciter, Rewayat} from '@/data/reciterData';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {resolveFilePath} from '@/services/downloadService';
import rewayatSlugs from '@/data/rewayat-slugs.json';

const R2_CDN_BASE = 'https://cdn.thebayaan.com';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function buildR2Url(
  reciter: Reciter,
  rewayat: Rewayat,
  paddedSurahId: string,
): string | null {
  const reciterSlug = slugify(reciter.name);
  const rewayahSlug =
    rewayatSlugs.rewayat[rewayat.name as keyof typeof rewayatSlugs.rewayat];
  const styleSlug =
    rewayatSlugs.styles[rewayat.style as keyof typeof rewayatSlugs.styles] ??
    'murattal';

  if (!rewayahSlug) {
    return null;
  }

  return `${R2_CDN_BASE}/quran/recitations/${reciterSlug}/${rewayahSlug}/${styleSlug}/default/${paddedSurahId}.mp3`;
}

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

  // Use R2 CDN for Supabase-hosted reciters
  if (rewayat.source_type === 'supabase') {
    const r2Url = buildR2Url(reciter, rewayat, paddedSurahId);
    if (r2Url) {
      return r2Url;
    }
  }

  // Fallback to original server URL
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
      const absolutePath = resolveFilePath(download.filePath);
      console.log(
        `Using local file for ${reciter.name} - Surah ${surahId} (Rewayat: ${rewayatId}): ${absolutePath}`,
      );
      return absolutePath;
    }
  } else {
    const download = downloadStore.getDownload(reciter.id, surahId);
    if (download && download.status === 'completed') {
      const absolutePath = resolveFilePath(download.filePath);
      console.log(
        `Using local file for ${reciter.name} - Surah ${surahId}: ${absolutePath}`,
      );
      return absolutePath;
    }
  }

  console.log(
    `Using remote URL for ${reciter.name} - Surah ${surahId}${
      rewayatId ? ` (Rewayat: ${rewayatId})` : ''
    }`,
  );
  return generateAudioUrl(reciter, surahId, rewayatId);
}
