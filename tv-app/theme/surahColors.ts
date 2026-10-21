/**
 * Per-surah colors for the TV UI, so each surah reads as its own tile the way
 * it does in the mobile app.
 *
 * Surah cards follow the phone's cards: deep ink with the surah's soft colour
 * glows from the mobile palettes (`components/hero/SurahGradientMesh.tsx`
 * MESH_PALETTES), which also tint the player's backdrop. The older muted
 * manuscript pigments remain one of the card styles below.
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

/**
 * The phone card's four glows (SurahGradientMesh): centre and radius as a
 * fraction of the card, and which of the three strengths each uses.
 */
export const SURAH_GLOW_BLOBS = [
  {cx: 0.2, cy: 0.3, r: 0.35, strength: 0},
  {cx: 0.75, cy: 0.7, r: 0.3, strength: 0},
  {cx: 0.55, cy: 0.2, r: 0.25, strength: 1},
  {cx: 0.35, cy: 0.8, r: 0.2, strength: 2},
] as const;

export type SurahCardStyle =
  | {
      kind: 'glow';
      /** The card's ink. */
      base: string;
      /** Glow strengths: main, tertiary, quaternary (phone: .12/.08/.06). */
      opacity: readonly [number, number, number];
    }
  | {kind: 'pigment'};

/**
 * The surah card styles shown to Osman as samples (A to D). The phone's own
 * strengths (B) nearly vanish from across a room, so A raises them.
 */
export const SURAH_CARD_STYLES = {
  phoneGlow: {kind: 'glow', base: '#0b1820', opacity: [0.42, 0.3, 0.22]},
  phoneExact: {kind: 'glow', base: '#050b10', opacity: [0.12, 0.08, 0.06]},
  phoneVivid: {kind: 'glow', base: '#0b1820', opacity: [0.75, 0.55, 0.45]},
  pigment: {kind: 'pigment'},
} as const satisfies Record<string, SurahCardStyle>;

/** The style every surah card uses. */
export const SURAH_CARD_STYLE: SurahCardStyle = SURAH_CARD_STYLES.phoneGlow;
