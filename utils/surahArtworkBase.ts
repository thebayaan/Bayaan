// utils/surahArtworkBase.ts
// The surah card base shared by CarPlay, Android Auto and the widgets
// (`branding.surahArtworkCdnBase`, RFC-021). No imports, so build scripts and
// tests can use it directly.

export const DEFAULT_SURAH_ARTWORK_BASE =
  'https://cdn.thebayaan.com/assets/car/surah/';

/**
 * Normalizes a fork-supplied surah artwork base to an https URL ending in '/'.
 * Absent or non-https values fall back to Bayaan's CDN.
 */
export function normalizeSurahArtworkBase(raw: string | undefined): string {
  const trimmed = raw?.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_SURAH_ARTWORK_BASE;
  const base = `${trimmed}/`;
  // Same rule the Android artwork provider enforces.
  if (/^https:\/\/[^\s?#\\]+\/$/.test(base) && !base.includes('/../')) {
    return base;
  }
  if (__DEV__)
    console.warn(
      '[branding] surahArtworkCdnBase must be an https URL; using the default',
    );
  return DEFAULT_SURAH_ARTWORK_BASE;
}
