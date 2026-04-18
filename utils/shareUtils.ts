import {Share} from 'react-native';

const BASE_URL = 'https://app.thebayaan.com';

export function verseShareUrl(surah: number, ayah: number): string {
  return `${BASE_URL}/quran/${surah}/${ayah}`;
}

export function surahShareUrl(surah: number, ayah?: number): string {
  return ayah
    ? `${BASE_URL}/quran/${surah}?v=${ayah}`
    : `${BASE_URL}/quran/${surah}`;
}

export function reciterShareUrl(slug: string): string {
  return `${BASE_URL}/reciter/${slug}`;
}

export function recitationShareUrl(
  slug: string,
  surahNum: number,
  rewayahId?: string,
  tSec?: number,
): string {
  const params = new URLSearchParams();
  if (rewayahId) params.set('rewayah', rewayahId);
  if (tSec) params.set('t', String(tSec));
  const q = params.toString();
  return `${BASE_URL}/reciter/${slug}/${surahNum}${q ? `?${q}` : ''}`;
}

export function mushafShareUrl(page: number, theme?: 'light'): string {
  return theme === 'light'
    ? `${BASE_URL}/mushaf/${page}?theme=light`
    : `${BASE_URL}/mushaf/${page}`;
}

export function adhkarShareUrl(superId: string): string {
  return `${BASE_URL}/adhkar/${superId}`;
}

export function dhikrShareUrl(superId: string, dhikrId: string): string {
  return `${BASE_URL}/adhkar/${superId}/${dhikrId}`;
}

export async function shareUrl(url: string, message: string): Promise<void> {
  await Share.share({message: `${message}\n${url}`, url});
}
