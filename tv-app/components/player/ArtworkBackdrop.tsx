import React, {useEffect, useRef} from 'react';
import {Image} from 'expo-image';
import {Animated, Easing, StyleSheet, View} from 'react-native';

type Props = {imageUrl: string | null};

export function ArtworkBackdrop({imageUrl}: Props): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!imageUrl) return;
    scale.setValue(1);
    Animated.loop(
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
    ).start();
  }, [imageUrl, scale]);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {imageUrl ? (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, {transform: [{scale}]}]}>
          <Image
            source={{uri: imageUrl}}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={80}
            cachePolicy="memory-disk"
            priority="high"
          />
        </Animated.View>
      ) : null}
      <View style={[StyleSheet.absoluteFillObject, styles.baseScrim]} />
      <View style={styles.bottomBoost} />
    </View>
  );
}

const styles = StyleSheet.create({
  baseScrim: {backgroundColor: 'rgba(0,0,0,0.5)'},
  bottomBoost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
