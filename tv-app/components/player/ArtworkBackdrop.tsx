import React, {useEffect, useRef} from 'react';
import {Image} from 'expo-image';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {createScaledStyles} from '../../theme/scale';
import type {ArtworkSource} from '../../services/reciterArtwork';

type Props = {artwork: ArtworkSource | null};

// Cinematic Now Playing backdrop: a slow ken-burns blurred render of the
// current artwork, fading into the app background through layered gradients so
// the title, scrubber and transport row at the bottom stay legible from across
// a room. All scrim colors are derived from the theme background token; only
// their opacity varies per gradient stop.
const SCRIM = colors.background;

export function ArtworkBackdrop({artwork}: Props): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!artwork) return;
    scale.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 16000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 16000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [artwork, scale]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {artwork ? (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, {transform: [{scale}]}]}>
          <Image
            source={artwork}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={80}
            cachePolicy="memory-disk"
            priority="high"
          />
        </Animated.View>
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.placeholder]} />
      )}
      <Svg style={StyleSheet.absoluteFillObject}>
        <Defs>
          {/* Soft vignette: keeps the centre (where the artwork card sits)
              luminous while sinking the edges into the background. */}
          <RadialGradient id="vignette" cx="50%" cy="34%" r="78%">
            <Stop offset={0} stopColor={SCRIM} stopOpacity={0} />
            <Stop offset={0.65} stopColor={SCRIM} stopOpacity={0.22} />
            <Stop offset={1} stopColor={SCRIM} stopOpacity={0.7} />
          </RadialGradient>
          {/* Vertical scrim: gentle darkening up top for the up-next hint, a
              clear window through the upper-middle, then a deep wash at the
              bottom so the transport stack reads cleanly. */}
          <LinearGradient id="vertical" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={SCRIM} stopOpacity={0.55} />
            <Stop offset={0.32} stopColor={SCRIM} stopOpacity={0.15} />
            <Stop offset={0.62} stopColor={SCRIM} stopOpacity={0.45} />
            <Stop offset={1} stopColor={SCRIM} stopOpacity={0.97} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#vignette)" />
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#vertical)" />
      </Svg>
    </View>
  );
}

const styles = createScaledStyles({
  placeholder: {backgroundColor: colors.surface},
});
