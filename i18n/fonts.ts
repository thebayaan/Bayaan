// @ai-generated
import {currentLanguage} from './language';
import {getLanguageConfig, type UiFont} from './languages';

const manrope = {
  'Manrope-Regular': require('@/assets/fonts/Manrope-Regular.ttf'),
  'Manrope-Bold': require('@/assets/fonts/Manrope-Bold.ttf'),
  'Manrope-Medium': require('@/assets/fonts/Manrope-Medium.ttf'),
  'Manrope-SemiBold': require('@/assets/fonts/Manrope-SemiBold.ttf'),
  'Manrope-Light': require('@/assets/fonts/Manrope-Light.ttf'),
  'Manrope-ExtraLight': require('@/assets/fonts/Manrope-ExtraLight.ttf'),
  'Manrope-ExtraBold': require('@/assets/fonts/Manrope-ExtraBold.ttf'),
};

// Manrope has no Arabic glyphs. In Arabic mode the Manrope aliases resolve to
// the matching IBM Plex Sans Arabic weight so existing styles need no changes.
// Plex Sans Arabic has no ExtraBold; Bold is the closest weight.
const plexSansArabic: Record<keyof typeof manrope, number> = {
  'Manrope-Regular': require('@/assets/fonts/IBMPlexSansArabic-Regular.ttf'),
  'Manrope-Bold': require('@/assets/fonts/IBMPlexSansArabic-Bold.ttf'),
  'Manrope-Medium': require('@/assets/fonts/IBMPlexSansArabic-Medium.ttf'),
  'Manrope-SemiBold': require('@/assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
  'Manrope-Light': require('@/assets/fonts/IBMPlexSansArabic-Light.ttf'),
  'Manrope-ExtraLight': require('@/assets/fonts/IBMPlexSansArabic-ExtraLight.ttf'),
  'Manrope-ExtraBold': require('@/assets/fonts/IBMPlexSansArabic-Bold.ttf'),
};

const fontFiles: Record<UiFont, Record<keyof typeof manrope, number>> = {
  manrope,
  plexSansArabic,
};

export const uiFontFiles = fontFiles[getLanguageConfig(currentLanguage).uiFont];
