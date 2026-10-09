/**
 * Vega has no expo-font. Fonts bundled with the package are available by
 * family name without runtime registration, so there is nothing to wait for.
 */
export function useBrandFonts(): boolean {
  return true;
}
