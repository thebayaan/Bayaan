import {useFonts} from 'expo-font';
import {fonts} from '../theme/typography';

/**
 * Registers the Manrope brand faces so `typography.fontFamily` resolves to the
 * real brand font instead of the platform fallback. The map keys are the
 * family names exported from `theme/typography.ts` so registered names always
 * match what styles reference. Returns true once the fonts are ready.
 */
export function useBrandFonts(): boolean {
  const [loaded] = useFonts({
    [fonts.regular]: require('../assets/fonts/Manrope-Regular.ttf'),
    [fonts.medium]: require('../assets/fonts/Manrope-Medium.ttf'),
    [fonts.semiBold]: require('../assets/fonts/Manrope-SemiBold.ttf'),
    [fonts.bold]: require('../assets/fonts/Manrope-Bold.ttf'),
    [fonts.extraBold]: require('../assets/fonts/Manrope-ExtraBold.ttf'),
    [fonts.light]: require('../assets/fonts/Manrope-Light.ttf'),
    [fonts.extraLight]: require('../assets/fonts/Manrope-ExtraLight.ttf'),
  });
  return loaded;
}
