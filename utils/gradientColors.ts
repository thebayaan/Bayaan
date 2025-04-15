import Color from 'color';

// Define gradient color options
export const GRADIENT_COLORS = [
  '#7C3AED', // Purple
  '#2563EB', // Blue
  '#059669', // Emerald
  '#DC2626', // Red
  '#EA580C', // Orange
  '#0891B2', // Cyan
  '#BE185D', // Pink
  '#4F46E5', // Indigo
  '#B45309', // Amber
  '#047857', // Dark Emerald
] as const;

// Cache for gradient colors to prevent recalculating on every render
const colorCache = new Map<number, readonly [string, string, string]>();

export const getRandomColors = (
  surahId?: number,
): readonly [string, string, string] => {
  // If surahId is provided and we have cached colors, return them
  if (surahId && colorCache.has(surahId)) {
    return colorCache.get(surahId) || getRandomColorsInternal();
  }

  // Generate new colors
  const colors = getRandomColorsInternal();

  // Cache the result if surahId is provided
  if (surahId) {
    colorCache.set(surahId, colors);
  }

  return colors;
};

// Helper function to actually generate the colors
export const getRandomColorsInternal = (): readonly [string, string, string] => {
  // Fisher-Yates shuffle
  const shuffled = [...GRADIENT_COLORS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return [shuffled[0], shuffled[1], shuffled[2]] as const;
};

// Convert colors to gradient with alpha values based on theme
export const getThemedGradientColors = (
  colors: readonly [string, string, string],
  isDarkMode: boolean,
  isRevealed = false,
): readonly [string, string, string] => {
  const alpha1 = isDarkMode ? 0.7 : 0.15;
  const alpha2 = isDarkMode ? 0.6 : 0.1;
  const alpha3 = isDarkMode ? 0.5 : 0.05;
  
  return [
    Color(colors[0])
      .alpha(isRevealed ? 0 : alpha1)
      .toString(),
    Color(colors[1])
      .alpha(isRevealed ? 0 : alpha2)
      .toString(),
    Color(colors[2])
      .alpha(isRevealed ? 0 : alpha3)
      .toString(),
  ] as const;
}; 