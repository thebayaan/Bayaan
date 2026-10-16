import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import {DEFAULT_SURAH_ARTWORK_BASE} from '../../../utils/surahArtworkBase';
import {GradientFill} from './GradientFill';
import {SurahGlyph} from './SurahGlyph';
import {surahGradient} from '../../theme/surahColors';

/** The phone's dark surah card on R2 (512 px, calligraphy and name). */
export function surahArtworkUrl(surahNumber: number): string {
  return `${DEFAULT_SURAH_ARTWORK_BASE}${surahNumber}.png`;
}

type Props = {
  surahNumber: number;
  /** Size of the calligraphy shown until (or unless) the card loads. */
  glyphSize: number;
  /** Gradient id for the placeholder, unique per screen. */
  id: string;
};

/**
 * A surah's artwork: the same card the phone, widgets and CarPlay use, from
 * the CDN. The pigment and calligraphy sit underneath, so the slot is never
 * empty while the card loads or when the network is down. Fills its parent;
 * wide slots crop the card's empty top and bottom, keeping the name.
 */
export function SurahArtwork({
  surahNumber,
  glyphSize,
  id,
}: Props): React.ReactElement {
  return (
    <View style={styles.fill}>
      <GradientFill colors={surahGradient(surahNumber)} id={id} />
      <SurahGlyph surahNumber={surahNumber} size={glyphSize} />
      <Image
        source={{uri: surahArtworkUrl(surahNumber)}}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        accessible={false}
      />
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
