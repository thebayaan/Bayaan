import React, {useState} from 'react';
import {
  StyleSheet,
  View,
  type ImageStyle,
  type LayoutChangeEvent,
} from 'react-native';
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
      {/* Zoomed by layout, not a transform: expo-image decodes the 1200 px
          card down to the view's laid-out size, so a transform would blow a
          small bitmap back up (jagged text on Android). recyclingKey clears
          a recycled grid cell at once instead of showing the last surah. */}
      <Image
        source={{uri: surahArtworkUrl(surahNumber)}}
        style={zoomedFill(zoom)}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={String(surahNumber)}
        transition={200}
        accessible={false}
      />
    </View>
  );
}

/** Fills the parent at `zoom` times its size, centred (parent clips). */
function zoomedFill(zoom: number): ImageStyle {
  const overflow = `${((zoom - 1) / 2) * -100}%` as const;
  const size = `${zoom * 100}%` as const;
  return {
    position: 'absolute',
    left: overflow,
    top: overflow,
    width: size,
    height: size,
  };
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
