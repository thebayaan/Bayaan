import {Share, Platform} from 'react-native';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import branding from '@/config/branding';
// @ai-start
import {parseAnchorKey} from '@/services/mushaf/RewayahVerseUnits';
// @ai-end

const BASE_URL = branding.shareBaseUrl;

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

// @ai-start
// ── Verse links of a rewayah (decision 3: rewayah verse units) ────────────
//
// A verse link names its verse by the Hafs location of the verse's first
// word (its storage anchor, verse-units contract section 3), which every
// rewayah shares:
//   /quran/S/A?rewayah=<id>          the verse holding the first word of
//                                    Hafs S:A, in rewayah <id> (anchors
//                                    "S:A" and "S:A:1");
//   /quran/S/A?rewayah=<id>&word=W   the verse holding Hafs word S:A:W: the
//                                    later part of a split Hafs verse
//                                    (Warsh 1:7 is /quran/1/7?rewayah=warsh
//                                    &word=5; Warsh 1:6 is /quran/1/7?...).
// The path stays a Hafs verse because the web reader behind shareBaseUrl
// knows Hafs verses only: it shows /quran/S/A as Hafs S:A (the verse that
// holds the shared verse's first word), answers 404 past the Hafs verse
// count, and does not read the query (checked on the live site). A rewayah
// verse number in the path would open another verse there. Hafs links
// never carry `word` and are unchanged. The in-app /quran routes are
// redirect stubs, so the app only writes these links; a reader of one lands
// on exactly the shared verse by taking the verse of rewayah <id> that holds
// Hafs word S:A:W (W = 1 without `word`).

/**
 * Share URL of a verse named by its storage anchor ("S:A" or "S:A:W",
 * RewayahVerseUnits.hafsAnchor(unit).key) in `rewayah`. Equals
 * verseShareUrl(S, A, theme, rewayah) except that an anchor past the Hafs
 * verse's first word (W > 1) of a non-Hafs rewayah adds `word=W`. Null for
 * an invalid anchor.
 */
export function anchorShareUrl(
  anchorKey: string,
  theme?: 'dark' | 'light',
  rewayah?: string,
): string | null {
  const loc = parseAnchorKey(anchorKey);
  if (!loc) return null;
  const url = verseShareUrl(loc.surah, loc.ayah, theme, rewayah);
  if (loc.word === 1 || !rewayah || rewayah === 'hafs') return url;
  return `${url}${url.includes('?') ? '&' : '?'}word=${loc.word}`;
}
// @ai-end

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
