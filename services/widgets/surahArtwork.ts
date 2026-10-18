// services/widgets/surahArtwork.ts
// Where the widgets download surah cards from: the same base as CarPlay and
// Android Auto, `branding.surahArtworkCdnBase` (RFC-021).
import branding from '@/config/branding';
import {normalizeSurahArtworkBase} from '@/utils/surahArtworkBase';

const SURAH_ARTWORK_BASE = normalizeSurahArtworkBase(
  branding.surahArtworkCdnBase,
);

// The dark surah cards (512 px PNGs).
export function surahArtworkUrl(
  surahId: number,
  base: string = SURAH_ARTWORK_BASE,
): string {
  return `${base}${surahId}.png`;
}
