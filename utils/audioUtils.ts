import {Reciter} from '@/data/reciterData';

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
