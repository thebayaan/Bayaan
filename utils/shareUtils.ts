import {Share, Platform} from 'react-native';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import branding from '@/config/branding';
// @ai-start
import {
  formatAnchorKey,
  parseAnchorKey,
  type RewayahVerseUnits,
  type VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import {
  PERSISTED_ID_MIGRATIONS,
  isRewayahId,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
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
// A verse link names its verse by the verse's storage anchor (verse-units
// contract, section 3), a Hafs location that every rewayah shares:
//   /quran/S/A?rewayah=<id>          the verse holding the first word of
//                                    Hafs S:A, in rewayah <id>;
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
// redirect stubs; resolveVerseShareLink() is the resolution any reader of
// these links must apply to land on exactly the shared verse.

/**
 * Share URL of a verse named by its storage anchor ("S:A" or "S:A:W",
 * RewayahVerseUnits.hafsAnchor(unit).key) in `rewayah`. Equals
 * verseShareUrl(S, A, theme, rewayah) except that a mid-verse anchor of a
 * non-Hafs rewayah adds `word=W`. Null for an invalid anchor.
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

/** A parsed verse link (see the section comment above). */
export interface VerseShareLink {
  /** Hafs verse of the path. */
  surah: number;
  ayah: number;
  /** Hafs word position named by `word` (1 without it). */
  word: number;
  /** `rewayah` query param, canonical id; Hafs without it. */
  rewayah: RewayahId;
  /** The storage anchor the link names ("S:A" or "S:A:W"). */
  anchor: string;
}

const VERSE_LINK_PATH = /\/quran\/(\d{1,3})\/(\d{1,3})\/?$/;
const POSITIVE_INT = /^[1-9]\d{0,2}$/;

function queryParams(query: string): Map<string, string> | null {
  const params = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq < 0 ? part : part.slice(0, eq);
    const rawValue = eq < 0 ? '' : part.slice(eq + 1);
    try {
      params.set(
        decodeURIComponent(rawKey.replace(/\+/g, ' ')),
        decodeURIComponent(rawValue.replace(/\+/g, ' ')),
      );
    } catch {
      return null; // malformed escape
    }
  }
  return params;
}

/**
 * Parses a verse link (`https://<shareBaseUrl>/quran/S/A?...`, an app-scheme
 * or path-only form of it). Null when it is not a verse link or names its
 * rewayah or word ambiguously: an unknown `rewayah` (never guessed as Hafs)
 * or a `word` that is not a positive number. Old rewayah slugs map to their
 * canonical ids.
 */
export function parseVerseShareUrl(url: string): VerseShareLink | null {
  const hash = url.indexOf('#');
  const withoutHash = hash < 0 ? url : url.slice(0, hash);
  const q = withoutHash.indexOf('?');
  const path = q < 0 ? withoutHash : withoutHash.slice(0, q);
  const match = VERSE_LINK_PATH.exec(path);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  const params = queryParams(q < 0 ? '' : withoutHash.slice(q + 1));
  if (!params) return null;

  let rewayah: RewayahId = 'hafs';
  const rewayahParam = params.get('rewayah');
  if (rewayahParam !== undefined) {
    const canonical =
      PERSISTED_ID_MIGRATIONS[rewayahParam] ??
      (isRewayahId(rewayahParam) ? rewayahParam : null);
    if (!canonical) return null;
    rewayah = canonical;
  }
  let word = 1;
  const wordParam = params.get('word');
  if (wordParam !== undefined) {
    if (!POSITIVE_INT.test(wordParam)) return null;
    word = Number(wordParam);
  }
  return {
    surah,
    ayah,
    word,
    rewayah,
    anchor: formatAnchorKey(`${surah}:${ayah}`, word),
  };
}

/**
 * The verse a link names, in its rewayah's own numbering: the unit of
 * `units` (that rewayah's verse units) holding the link's anchor. Null when
 * `units` belong to another rewayah, or when no verse holds the anchor (a
 * verse or word the data does not have, or the unnumbered Fatiha basmala of
 * the Madani / Basri counts).
 */
export function resolveVerseShareLink(
  link: VerseShareLink,
  units: RewayahVerseUnits,
): VerseUnit | null {
  if (units.rewayah !== link.rewayah) return null;
  return units.unitForAnchor(link.anchor);
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
