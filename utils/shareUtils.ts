import {Share, Platform} from 'react-native';
import rewayatSlugs from '@/data/rewayat-slugs.json';
import type {Reciter, Rewayat} from '@/data/reciterData';

const BASE_URL = 'https://app.thebayaan.com';

export function reciterShareUrl(slug: string): string {
  return `${BASE_URL}/share/reciter/${slug}`;
}

export function recitationShareUrl(
  reciterSlug: string,
  rewayatSlug: string,
  styleSlug: string,
  surahNum: number,
  timestampSec?: number,
): string {
  const base = `${BASE_URL}/share/reciter/${reciterSlug}/${rewayatSlug}/${styleSlug}/surah/${surahNum}`;
  return timestampSec ? `${base}?t=${timestampSec}` : base;
}

export function mushafShareUrl(page: number): string {
  return `${BASE_URL}/share/mushaf/${page}`;
}

export function verseShareUrl(surah: number, ayah: number): string {
  return `${BASE_URL}/share/verse/${surah}/${ayah}`;
}

export function adhkarShareUrl(superId: string): string {
  return `${BASE_URL}/share/adhkar/${superId}`;
}

export function dhikrShareUrl(superId: string, dhikrId: string): string {
  return `${BASE_URL}/share/dhikr/${superId}/${dhikrId}`;
}

export function getRewayatSlug(rewayat: Rewayat): string | null {
  return (rewayatSlugs.rewayat as Record<string, string>)[rewayat.name] ?? null;
}

export function getStyleSlug(rewayat: Rewayat): string {
  return (
    (rewayatSlugs.styles as Record<string, string>)[rewayat.style] ?? 'murattal'
  );
}

export function resolveRewayat(
  reciter: Reciter,
  rewayatSlug: string,
  styleSlug: string,
): Rewayat | undefined {
  return reciter.rewayat.find(rw => {
    const nameSlug = (rewayatSlugs.rewayat as Record<string, string>)[rw.name];
    const stSlug =
      (rewayatSlugs.styles as Record<string, string>)[rw.style] ?? 'murattal';
    return nameSlug === rewayatSlug && stSlug === styleSlug;
  });
}

export async function shareUrl(url: string, message: string): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Share.share({url, message});
    } else {
      await Share.share({message: `${message}\n${url}`});
    }
  } catch {
    // User dismissed or share failed
  }
}
