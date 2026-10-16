/**
 * Per-surah colors for the TV UI, so each surah reads as its own tile the way
 * it does in the mobile app.
 *
 * Tiles use muted manuscript pigments; the backdrop glows come from the mobile
 * palettes (`components/hero/SurahGradientMesh.tsx` MESH_PALETTES).
 * Unlike mobile, which shuffles colors per session, TV colors are fixed per
 * surah: the screen is shared and left on, so Al-Kahf should look the same
 * every Friday.
 */

/**
 * Muted manuscript pigments for surah art (Ink & Cream). Deep enough that the
 * cream calligraphy reads on them and the verse text stays the loudest thing
 * on screen.
 */
export const PIGMENTS = {
  lapis: '#2b4c7e',
  malachite: '#2e6b57',
  carmine: '#8e2f3c',
  saffron: '#b8832b',
  indigo: '#33356e',
  verdigris: '#3d7a76',
  ochre: '#9a6a34',
  madder: '#8a4a5e',
} as const;

export const TILE_HUES: readonly string[] = Object.values(PIGMENTS);

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
 * play), matching the approved component designs. Everything else is derived.
 */
const FEATURED_PAIRS: Readonly<Record<number, readonly [string, string]>> = {
  1: [PIGMENTS.lapis, PIGMENTS.verdigris],
  2: [PIGMENTS.ochre, PIGMENTS.madder],
  18: [PIGMENTS.indigo, PIGMENTS.lapis],
  19: [PIGMENTS.madder, PIGMENTS.indigo],
  32: [PIGMENTS.indigo, PIGMENTS.malachite],
  36: [PIGMENTS.malachite, PIGMENTS.verdigris],
  55: [PIGMENTS.madder, PIGMENTS.indigo],
  56: [PIGMENTS.saffron, PIGMENTS.ochre],
  67: [PIGMENTS.indigo, PIGMENTS.carmine],
  73: [PIGMENTS.malachite, PIGMENTS.indigo],
  112: [PIGMENTS.verdigris, PIGMENTS.malachite],
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
  const from = TILE_HUES[(n * 5) % TILE_HUES.length];
  let to = TILE_HUES[(n * 3 + 3) % TILE_HUES.length];
  if (to === from) to = TILE_HUES[(n * 3 + 4) % TILE_HUES.length];
  return [from, to];
}

/** Backdrop glow palette for a surah (mobile `paletteForSurah`). */
export function surahGlow(surahNumber: number): GlowPalette {
  return GLOW_PALETTES[(clampSurah(surahNumber) - 1) % GLOW_PALETTES.length];
}
