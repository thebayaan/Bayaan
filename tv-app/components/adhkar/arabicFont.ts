import type {TextStyle} from 'react-native';
import {quranTextFontAvailable} from '../../theme/calligraphy';
import {quranTextFontFamily} from '../../theme/typography';

/**
 * The Arabic face for adhkar: the app's Uthmanic Hafs where it is registered,
 * the system Arabic font elsewhere (Vega).
 */
export const arabicFontStyle: TextStyle = quranTextFontAvailable
  ? {fontFamily: quranTextFontFamily, writingDirection: 'rtl'}
  : {writingDirection: 'rtl'};
