import {Reciter} from '@/data/reciterData';

export function generateAudioUrl(reciter: Reciter, surahId: string): string {
  const paddedSurahId = surahId.padStart(3, '0');

  // If the server URL is a Supabase storage URL
  if (reciter.server.includes('supabase.co')) {
    return `${reciter.server}/${paddedSurahId}.mp3`;
  }

  // Default mp3quran.net URL
  return `${reciter.server}/${paddedSurahId}.mp3`;
}
