import React from 'react';
import {StyleSheet, View} from 'react-native';
import {GradientFill} from '../brand/GradientFill';
import {SurahGlyph} from '../brand/SurahGlyph';
import {surahGradient} from '../../theme/surahColors';

type Props = {
  surahNumber: number;
  /** Calligraphy size in design pixels. */
  glyphSize: number;
  /** Gradient id, unique per screen. */
  id: string;
};

/**
 * A surah for slots too small for its CDN card (Continue thumbnails, the
 * Now playing strip): only the calligraphy on the surah's pigment. The
 * card's printed name and subtitle would shrink to an unreadable smear
 * there. Fills its parent, which sets size, radius and clipping.
 */
export function SurahThumb({
  surahNumber,
  glyphSize,
  id,
}: Props): React.ReactElement {
  return (
    <View style={styles.fill}>
      <GradientFill colors={surahGradient(surahNumber)} id={id} />
      <SurahGlyph surahNumber={surahNumber} size={glyphSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
