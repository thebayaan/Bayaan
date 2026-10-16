import React from 'react';
import {Text, type StyleProp, type TextStyle} from 'react-native';
import {surahGlyphMap} from '../../../utils/surahGlyphMap';
import SURAHS from '../../../data/surahData.json';
import {surahGlyphsAvailable} from '../../theme/calligraphy';
import {colors} from '../../theme/colors';
import {fonts, surahNameFontFamily} from '../../theme/typography';
import {scale} from '../../theme/scale';

type SurahMeta = {id: number; name: string};

type Props = {
  surahNumber: number;
  /** Glyph size in 1920x1080 design pixels. */
  size: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

function surahName(surahNumber: number): string {
  return (
    (SURAHS as SurahMeta[]).find(s => s.id === surahNumber)?.name ??
    `Surah ${surahNumber}`
  );
}

/**
 * A surah's name in calligraphy, used as artwork on tiles, the sidebar's
 * now-playing chip and the player. Where the calligraphy font is unavailable
 * (Vega) it shows the transliterated name instead, sized to fit the same box.
 */
export function SurahGlyph({
  surahNumber,
  size,
  color = colors.text,
  style,
}: Props): React.ReactElement {
  const glyph = surahGlyphMap[surahNumber];
  if (surahGlyphsAvailable && glyph) {
    return (
      <Text
        accessibilityLabel={surahName(surahNumber)}
        style={[
          {
            fontFamily: surahNameFontFamily,
            fontSize: scale(size),
            lineHeight: scale(size * 1.25),
            color,
          },
          style,
        ]}>
        {glyph}
      </Text>
    );
  }
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      style={[
        {
          fontFamily: fonts.bold,
          fontWeight: '700',
          fontSize: scale(size * 0.4),
          color,
        },
        style,
      ]}>
      {surahName(surahNumber)}
    </Text>
  );
}
