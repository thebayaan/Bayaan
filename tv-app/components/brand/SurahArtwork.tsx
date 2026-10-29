import React, {useState} from 'react';
import {StyleSheet, Text, View, type LayoutChangeEvent} from 'react-native';
import {GradientFill} from './GradientFill';
import {SurahGlyph} from './SurahGlyph';
import {SURAHS} from '../../services/browseCatalog';
import {showsSurahName, surahNameSize} from '../../services/surahArtwork';
import {colors} from '../../theme/colors';
import {surahGradient} from '../../theme/surahColors';
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
 * A surah's artwork, drawn rather than downloaded: its pigment gradient,
 * the name in calligraphy and, in a slot wide enough, the transliterated
 * name as real text. Every word on it is sharp at any size and on every
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
  const [named, setNamed] = useState(false);
  const onLayout = (e: LayoutChangeEvent): void => {
    setNamed(showsSurahName(e.nativeEvent.layout.width / scaleFactor));
  };
  const name = SURAHS[surahNumber - 1]?.name;
  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GradientFill colors={surahGradient(surahNumber)} id={id} />
      <SurahGlyph surahNumber={surahNumber} size={glyphSize} />
      {named && name ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessible={false}
          style={[
            styles.name,
            {
              fontSize: scale(surahNameSize(glyphSize)),
              marginTop: scale(-glyphSize * 0.12),
            },
          ]}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
