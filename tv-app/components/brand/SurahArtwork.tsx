import React, {useState} from 'react';
import {StyleSheet, Text, View, type LayoutChangeEvent} from 'react-native';
import {SurahFill} from './SurahFill';
import {SurahGlyph} from './SurahGlyph';
import {SURAHS} from '../../services/browseCatalog';
import {showsSurahName, surahNameSize} from '../../services/surahArtwork';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {scale, scaleFactor} from '../../theme/scale';

type Props = {
  surahNumber: number;
  /** Size of the calligraphy, in design pixels. */
  glyphSize: number;
  /** Gradient id for the pigment, unique per screen. */
  id: string;
};

/**
 * A surah's artwork, drawn rather than downloaded, laid out like the phone's
 * surah card: the surah's colour glows, the name in calligraphy and, in a
 * slot wide enough, a short divider and the transliterated name as real
 * text. The calligraphy is sized to the slot's width, so long names never
 * run off the card. Every word on it is sharp at any size and on every
 * platform (the old 1200 px share cards, decoded down to tile size, left
 * their small print smeared), there is nothing to wait for or lose offline,
 * and the English meaning stays with the places that print it below.
 * Fills its parent.
 */
export function SurahArtwork({
  surahNumber,
  glyphSize,
  id,
}: Props): React.ReactElement {
  // The slot's width in design px, once laid out.
  const [width, setWidth] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent): void => {
    setWidth(e.nativeEvent.layout.width / scaleFactor);
  };
  const named = width !== null && showsSurahName(width);
  const name = SURAHS[surahNumber - 1]?.name;
  return (
    <View style={styles.fill} onLayout={onLayout}>
      <SurahFill surahNumber={surahNumber} id={id} />
      {width === null ? null : (
        <SurahGlyph
          surahNumber={surahNumber}
          size={glyphSize}
          fitWidth={width - Math.min(GLYPH_INSET, width * 0.1) * 2}
        />
      )}
      {named && name ? (
        <>
          <View style={styles.divider} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            accessible={false}
            style={[styles.name, {fontSize: scale(surahNameSize(glyphSize))}]}>
            {name}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/**
 * Room kept clear on each side of the calligraphy, in design px (a tenth of
 * the width on thumbnails).
 */
const GLYPH_INSET = 20;

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  divider: {
    width: '30%',
    height: Math.max(1, scale(2)),
    marginTop: scale(12),
    marginBottom: scale(8),
    backgroundColor: colors.text,
    opacity: 0.18,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
    paddingHorizontal: scale(14),
    maxWidth: '100%',
  },
});
