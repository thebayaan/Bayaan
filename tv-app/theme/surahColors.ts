/**
 * Per-surah colors for the TV UI, so each surah reads as its own tile the way
 * it does in the mobile app.
 *
 * The hues come from the mobile palettes (`utils/gradientColors.ts`
 * GRADIENT_COLORS and `components/hero/SurahGradientMesh.tsx` MESH_PALETTES).
 * Unlike mobile, which shuffles colors per session, TV colors are fixed per
 * surah: the screen is shared and left on, so Al-Kahf should look the same
 * every Friday.
 */

/** Saturated tile hues (mobile GRADIENT_COLORS). */
export const TILE_HUES = [
  '#7C3AED', // Purple
  '#2563EB', // Blue
  '#059669', // Emerald
  '#DC2626', // Red
  '#EA580C', // Orange
  '#0891B2', // Cyan
  '#BE185D', // Pink
  '#4F46E5', // Indigo
  '#B45309', // Amber
  '#047857', // Dark emerald
] as const;

/** Soft glow palettes for full-screen backdrops (mobile MESH_PALETTES). */
export const GLOW_PALETTES = [
  ['#e879f9', '#a78bfa', '#38bdf8', '#34d399'],
  ['#38bdf8', '#818cf8', '#5eead4', '#a78bfa'],
  ['#fbbf24', '#fb923c', '#f87171', '#e879f9'],
  ['#f9a8d4', '#fb7185', '#a78bfa', '#38bdf8'],
  ['#34d399', '#86efac', '#38bdf8', '#a78bfa'],
  ['#a5b4fc', '#c4b5fd', '#f9a8d4', '#5eead4'],
] as const;

export type GlowPalette = (typeof GLOW_PALETTES)[number];

/**
 * Hand-picked pairs for the surahs the TV app features most (moments, quick
 * play), matching the approved screen designs. Everything else is derived.
 */
const FEATURED_PAIRS: Readonly<Record<number, readonly [string, string]>> = {
  1: ['#7C3AED', '#0891B2'],
  2: ['#B45309', '#BE185D'],
  18: ['#2563EB', '#4F46E5'],
  19: ['#BE185D', '#7C3AED'],
  32: ['#4F46E5', '#0F766E'],
  36: ['#047857', '#0891B2'],
  55: ['#4F46E5', '#BE185D'],
  56: ['#EA580C', '#B45309'],
  67: ['#312E81', '#2563EB'],
  73: ['#059669', '#4F46E5'],
  112: ['#0891B2', '#047857'],
};

function clampSurah(surahNumber: number): number {
  if (!Number.isFinite(surahNumber)) return 1;
  return Math.min(114, Math.max(1, Math.round(surahNumber)));
}

/** Two-stop tile gradient for a surah, stable across launches. */
export function surahGradient(surahNumber: number): readonly [string, string] {
  const n = clampSurah(surahNumber);
  const featured = FEATURED_PAIRS[n];
  if (featured) return featured;
  const from = TILE_HUES[(n * 7) % TILE_HUES.length];
  let to = TILE_HUES[(n * 3 + 4) % TILE_HUES.length];
  if (to === from) to = TILE_HUES[(n * 3 + 5) % TILE_HUES.length];
  return [from, to];
}

/** Backdrop glow palette for a surah (mobile `paletteForSurah`). */
export function surahGlow(surahNumber: number): GlowPalette {
  return GLOW_PALETTES[(clampSurah(surahNumber) - 1) % GLOW_PALETTES.length];
}
