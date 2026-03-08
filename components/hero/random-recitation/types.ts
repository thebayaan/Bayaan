// 5 design families for icon-based cards
export type DesignFamily = 'arabesque' | 'bloom' | 'aurora' | 'mosaic' | 'mesh';

// Icon variants per design (4B compass excluded)
export type ArabesqueIcon = 'ornate-star' | 'rosette' | 'hex-knot' | 'arches';
export type BloomIcon = 'petal' | 'spiral-rose' | 'butterfly' | 'dahlia';
export type AuroraIcon = 'orbital' | 'ripple' | 'vesica';
export type MosaicIcon =
  | 'color-grid'
  | 'scattered'
  | 'zellige'
  | 'stained-glass';
export type MeshIcon = 'prism' | 'dice' | 'pinwheel' | 'constellation';

// Full-width spanning art designs
export type FullWidthDesign =
  | 'fw-arabesque'
  | 'fw-ribbon'
  | 'fw-mandala'
  | 'fw-mosaic'
  | 'fw-aurora'
  | 'fw-mesh'
  | 'fw-crescent';

export interface IconCardVariant {
  type: 'icon';
  design: DesignFamily;
  icon: string;
}

export interface FullWidthCardVariant {
  type: 'fullwidth';
  design: FullWidthDesign;
}

export type CardVariant = IconCardVariant | FullWidthCardVariant;

export interface CopyVariant {
  label: string;
  subtitle: string;
}

// All 26 visual variants
export const ALL_VARIANTS: CardVariant[] = [
  // D1 Arabesque (4)
  {type: 'icon', design: 'arabesque', icon: 'ornate-star'},
  {type: 'icon', design: 'arabesque', icon: 'rosette'},
  {type: 'icon', design: 'arabesque', icon: 'hex-knot'},
  {type: 'icon', design: 'arabesque', icon: 'arches'},
  // D3 Bloom (4)
  {type: 'icon', design: 'bloom', icon: 'petal'},
  {type: 'icon', design: 'bloom', icon: 'spiral-rose'},
  {type: 'icon', design: 'bloom', icon: 'butterfly'},
  {type: 'icon', design: 'bloom', icon: 'dahlia'},
  // D4 Aurora (3, no compass)
  {type: 'icon', design: 'aurora', icon: 'orbital'},
  {type: 'icon', design: 'aurora', icon: 'ripple'},
  {type: 'icon', design: 'aurora', icon: 'vesica'},
  // D5 Mosaic (4)
  {type: 'icon', design: 'mosaic', icon: 'color-grid'},
  {type: 'icon', design: 'mosaic', icon: 'scattered'},
  {type: 'icon', design: 'mosaic', icon: 'zellige'},
  {type: 'icon', design: 'mosaic', icon: 'stained-glass'},
  // D7 Mesh (4)
  {type: 'icon', design: 'mesh', icon: 'prism'},
  {type: 'icon', design: 'mesh', icon: 'dice'},
  {type: 'icon', design: 'mesh', icon: 'pinwheel'},
  {type: 'icon', design: 'mesh', icon: 'constellation'},
  // Full-width (7)
  {type: 'fullwidth', design: 'fw-arabesque'},
  {type: 'fullwidth', design: 'fw-ribbon'},
  {type: 'fullwidth', design: 'fw-mandala'},
  {type: 'fullwidth', design: 'fw-mosaic'},
  {type: 'fullwidth', design: 'fw-aurora'},
  {type: 'fullwidth', design: 'fw-mesh'},
  {type: 'fullwidth', design: 'fw-crescent'},
];

// All 6 copy variants
export const COPY_VARIANTS: CopyVariant[] = [
  {label: 'Shuffle & Listen', subtitle: 'Let the Quran surprise you'},
  {label: 'Discover', subtitle: 'Hear something new'},
  {label: 'Explore', subtitle: 'Discover a new voice'},
  {label: 'Random Recitation', subtitle: 'Surprise me'},
  {label: 'Shuffle & Listen', subtitle: 'Explore the unexpected'},
  {label: 'Random Mix', subtitle: 'A recitation chosen just for this moment'},
];

// Deterministic pick based on seed
export function pickVariant(seed: number): {
  visual: CardVariant;
  copy: CopyVariant;
} {
  const visualIndex = Math.abs(seed) % ALL_VARIANTS.length;
  const copyIndex =
    Math.abs(Math.floor(seed / ALL_VARIANTS.length)) % COPY_VARIANTS.length;
  return {
    visual: ALL_VARIANTS[visualIndex],
    copy: COPY_VARIANTS[copyIndex],
  };
}
