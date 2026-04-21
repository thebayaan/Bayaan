import {Share, Platform} from 'react-native';
import {analyticsService} from '@/services/analytics/AnalyticsService';

const BASE_URL = 'https://app.thebayaan.com';

export function reciterShareUrl(slug: string): string {
  return `${BASE_URL}/reciter/${slug}`;
}

export function recitationShareUrl(
  reciterSlug: string,
  surahNum: number,
  rewayahId?: string,
  timestampSec?: number,
): string {
  const params = new URLSearchParams();
  if (rewayahId) params.set('rewayah', rewayahId);
  if (timestampSec) params.set('t', String(timestampSec));
  const q = params.toString();
  return `${BASE_URL}/reciter/${reciterSlug}/${surahNum}${q ? `?${q}` : ''}`;
}

export function surahShareUrl(surah: number, ayah?: number): string {
  return ayah
    ? `${BASE_URL}/quran/${surah}?v=${ayah}`
    : `${BASE_URL}/quran/${surah}`;
}

export function verseShareUrl(
  surah: number,
  ayah: number,
  theme?: 'dark' | 'light',
  rewayah?: string,
): string {
  const params: string[] = [];
  if (theme === 'light') params.push('theme=light');
  if (rewayah && rewayah !== 'hafs') params.push(`rewayah=${rewayah}`);
  return params.length
    ? `${BASE_URL}/quran/${surah}/${ayah}?${params.join('&')}`
    : `${BASE_URL}/quran/${surah}/${ayah}`;
}

export function mushafShareUrl(page: number, theme?: 'dark' | 'light'): string {
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

function inferShareContentType(
  url: string,
): 'verse' | 'surah' | 'mushaf' | 'reciter' | 'adhkar' {
  if (/\/quran\/\d+\/\d+/.test(url)) return 'verse';
  if (/\/quran\/\d+/.test(url)) return 'surah';
  if (url.includes('/mushaf/')) return 'mushaf';
  if (url.includes('/adhkar/')) return 'adhkar';
  return 'reciter';
}

function extractSurahIdFromUrl(url: string): number | undefined {
  // Matches /quran/{surah} and /reciter/{slug}/{surah}
  const m = /(?:\/quran\/|\/reciter\/[^/]+\/)(\d+)/.exec(url);
  return m ? parseInt(m[1], 10) : undefined;
}

export async function shareUrl(url: string, message: string): Promise<void> {
  try {
    const contentType = inferShareContentType(url);
    const surahId = extractSurahIdFromUrl(url);

    analyticsService.trackShareCreated({
      content_type: contentType,
      ...(surahId !== undefined ? {surah_id: surahId} : {}),
    });

    if (Platform.OS === 'ios') {
      await Share.share({url});
    } else {
      await Share.share({message: `${message}\n${url}`});
    }
  } catch {
    // User dismissed or share failed
  }
}
