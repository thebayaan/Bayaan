import React from 'react';
import {
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {surahGlyphMap} from '../../../utils/surahGlyphMap';
import SURAHS from '../../../data/surahData.json';
import {surahGlyphsAvailable} from '../../theme/calligraphy';
import {colors} from '../../theme/colors';
import {fonts, surahNameFontFamily} from '../../theme/typography';
import {scale} from '../../theme/scale';
import {surahGlyphBox} from '../../services/surahArtwork';

type SurahMeta = {id: number; name: string};

type Props = {
  surahNumber: number;
  /** Glyph size in 1920x1080 design pixels. */
  size: number;
  color?: string;
  /** Layout for the glyph's box (margins, opacity), not its text. */
  style?: StyleProp<ViewStyle>;
  /**
   * Widest the calligraphy may be, in design px: long names (Al-Ikhlas,
   * Ali 'Imran) shrink to fit instead of running off their card.
   */
  fitWidth?: number;
};

function surahName(surahNumber: number): string {
  return (
    (SURAHS as SurahMeta[]).find(s => s.id === surahNumber)?.name ??
    `Surah ${surahNumber}`
  );
}

/**
 * A surah's name in calligraphy, used as artwork on tiles, the sidebar's
 * now-playing chip and the player. The glyph takes exactly the space its ink
 * covers (from the font's own measurements, see services/surahArtwork), so
 * the parent centres the calligraphy itself, not the font's lopsided box,
 * and `fitWidth` holds the ink inside a card. Where the calligraphy font is
 * unavailable it shows the transliterated name, sized to fit the same box.
 */
export function SurahGlyph({
  surahNumber,
  size,
  color = colors.text,
  style,
  fitWidth,
}: Props): React.ReactElement {
  const glyph = surahGlyphMap[surahNumber];
  if (surahGlyphsAvailable && glyph) {
    const box = surahGlyphBox(surahNumber, size, fitWidth);
    return (
      <View
        accessible
        accessibilityLabel={surahName(surahNumber)}
        style={[{width: scale(box.width), height: scale(box.height)}, style]}>
        <Text
          accessible={false}
          numberOfLines={1}
          style={{
            position: 'absolute',
            left: scale(box.textLeft),
            top: scale(box.textTop),
            width: scale(box.textWidth),
            fontFamily: surahNameFontFamily,
            fontSize: scale(box.fontSize),
            lineHeight: scale(box.lineHeight),
            color,
          }}>
          {glyph}
        </Text>
      </View>
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
        fitWidth === undefined ? null : {maxWidth: scale(fitWidth)},
        style as StyleProp<TextStyle>,
      ]}>
      {surahName(surahNumber)}
    </Text>
  );
}
