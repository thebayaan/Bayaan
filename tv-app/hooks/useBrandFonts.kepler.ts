/**
 * Vega has no expo-font. The Manrope files are packaged with the app instead
 * (tv-vega/scripts/sync-fonts.js copies them into tv-vega/assets/fonts before
 * every build) and Vega serves each under its file name, which is the family
 * name `theme/typography.ts` uses. Nothing to wait for at runtime.
 */
export function useBrandFonts(): boolean {
  return true;
}
