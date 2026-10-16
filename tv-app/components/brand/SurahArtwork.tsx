import React, {useState} from 'react';
import {StyleSheet, View, type LayoutChangeEvent} from 'react-native';
import {Image} from 'expo-image';
import {GradientFill} from './GradientFill';
import {SurahGlyph} from './SurahGlyph';
import {surahGradient} from '../../theme/surahColors';
import {surahArtworkZoom} from '../../services/surahArtworkZoom';

/** The surah cards on R2 (1200 px, dark): the set shared surah links use. */
const SURAH_ARTWORK_BASE = 'https://cdn.thebayaan.com/assets/og-images/surah/';

export function surahArtworkUrl(surahNumber: number): string {
  return `${SURAH_ARTWORK_BASE}${surahNumber}.png`;
}

type Props = {
  surahNumber: number;
  /** Size of the calligraphy shown until (or unless) the card loads. */
  glyphSize: number;
  /** Gradient id for the placeholder, unique per screen. */
  id: string;
};

/**
 * A surah's artwork card from the CDN. The pigment and calligraphy sit underneath, so the slot is never
 * empty while the card loads or when the network is down. Fills its parent
 * and zooms the card in (surahArtworkZoom) so the calligraphy fills the slot.
 */
export function SurahArtwork({
  surahNumber,
  glyphSize,
  id,
}: Props): React.ReactElement {
  const [zoom, setZoom] = useState(1);
  const onLayout = (e: LayoutChangeEvent): void => {
    const {width, height} = e.nativeEvent.layout;
    if (height > 0) setZoom(surahArtworkZoom(width / height));
  };
  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GradientFill colors={surahGradient(surahNumber)} id={id} />
      <SurahGlyph surahNumber={surahNumber} size={glyphSize} />
      <Image
        source={{uri: surahArtworkUrl(surahNumber)}}
        style={[StyleSheet.absoluteFill, {transform: [{scale: zoom}]}]}
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
    overflow: 'hidden',
  },
});
