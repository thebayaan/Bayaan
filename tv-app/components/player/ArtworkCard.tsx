import React, {useEffect, useRef} from 'react';
import {Image} from 'expo-image';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import {createScaledStyles, scale} from '../../theme/scale';
import type {ArtworkSource} from '../../services/reciterArtwork';

type Props = {artwork: ArtworkSource | null; reciterName: string};

export function ArtworkCard({artwork, reciterName}: Props): React.ReactElement {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(scale(12))).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translate, {
        toValue: 0,
        stiffness: 180,
        damping: 22,
        mass: 1,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [opacity, translate, artwork]);

  return (
    <Animated.View
      style={[styles.wrap, {opacity, transform: [{translateY: translate}]}]}
      pointerEvents="none">
      <View style={styles.card}>
        {artwork ? (
          <Image
            source={artwork}
            style={styles.img}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.initial}>
              {reciterName.charAt(0).toUpperCase() || '·'}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const SIZE = 360;

const styles = createScaledStyles({
  wrap: {
    position: 'absolute',
    top: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  card: {
    width: SIZE,
    height: SIZE,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: {width: 0, height: 16},
  },
  img: {width: '100%', height: '100%'},
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  initial: {
    color: colors.text,
    fontSize: 144,
    fontWeight: '200',
    opacity: 0.35,
  },
});
