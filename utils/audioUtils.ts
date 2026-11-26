import {Reciter, RECITERS} from '@/data/reciterData'; // @ai
// @ai-start
import {
  useDownloadStore,
  type DownloadedSurah,
} from '@/services/player/store/downloadStore';
// @ai-end
import {resolveFilePath} from '@/services/downloadService';
import {audioFileUrl} from '@/utils/audioFileUrl';
import {findRewayatForSurah} from '@/utils/rewayatForSurah'; // @ai

export function generateAudioUrl(
  reciter: Reciter,
  surahId: string,
  rewayatId?: string,
): string {
  // Get the rewayat - either specified or, with none, the first one that
  // has this surah (the first rewayah need not have it). @ai
  const rewayat = rewayatId
    ? reciter.rewayat.find(r => r.id === rewayatId)
    : (findRewayatForSurah(reciter, Number(surahId)) ?? reciter.rewayat[0]);

  if (!rewayat) {
    throw new Error('No rewayat found for reciter');
  }

  return audioFileUrl(rewayat, surahId);
}

// @ai-start
/**
 * The rewayah held by a download that was recorded without one (''). Such a
 * download fetches the reciter's first rewayah in catalogue order (see
 * fetchAudioUrl). It is read from the catalogue, never from a `reciter`
 * object handed in: the reciter screens pass copies whose rewayat are
 * re-sorted Hafs-first, and matching against those would play one rewayah's
 * file as another.
 */
function rewayahOfUnkeyedDownloads(reciterId: string): string | undefined {
  return RECITERS.find(r => r.id === reciterId)?.rewayat[0]?.id;
}

/**
 * The completed download to play for a recitation, or undefined when it has
 * to be streamed.
 */
export function findDownloadForPlayback(
  reciterId: string,
  surahId: string,
  rewayatId?: string,
): DownloadedSurah | undefined {
  const store = useDownloadStore.getState();
  const unkeyed = () => {
    const download = store.getDownload(reciterId, surahId);
    return download?.status === 'completed' ? download : undefined;
  };

  if (!rewayatId) return unkeyed();

  const exact = store.getDownloadWithRewayat(reciterId, surahId, rewayatId);
  if (exact) return exact;

  // A download made without a rewayah (Loved "Download all" on older loved
  // surahs, playlists and menus with no rewayah) is recorded under ''.
  // Playing it asks for the reciter's first rewayah by id, which never
  // matched: the row showed the downloaded badge but streamed, and failed
  // offline. Only the first rewayah may use that file; any other streams.
  return rewayatId === rewayahOfUnkeyedDownloads(reciterId)
    ? unkeyed()
    : undefined;
}
// @ai-end

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
  // @ai-start
  const download = findDownloadForPlayback(reciter.id, surahId, rewayatId);
  if (download) {
    const absolutePath = resolveFilePath(download.filePath);
    console.log(
      `Using local file for ${reciter.name} - Surah ${surahId}${
        rewayatId ? ` (Rewayat: ${rewayatId})` : ''
      }: ${absolutePath}`,
    );
    return absolutePath;
  }
  // @ai-end

  console.log(
    `Using remote URL for ${reciter.name} - Surah ${surahId}${
      rewayatId ? ` (Rewayat: ${rewayatId})` : ''
    }`,
  );
  return generateAudioUrl(reciter, surahId, rewayatId);
}
