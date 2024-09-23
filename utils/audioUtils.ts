import {Reciter} from '@/data/reciterData';

export function generateAudioUrl(reciter: Reciter, surahId: string): string {
  const paddedSurahId = surahId.padStart(3, '0');
  return `${reciter.server}/${paddedSurahId}.mp3`;
}
