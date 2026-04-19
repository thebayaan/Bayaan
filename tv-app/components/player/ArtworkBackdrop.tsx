import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, View} from 'react-native';

type Props = {imageUrl: string | null};

export function ArtworkBackdrop({imageUrl}: Props): React.ReactElement {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {imageUrl ? (
        <Image
          source={{uri: imageUrl}}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          blurRadius={80}
          cachePolicy="memory-disk"
          priority="high"
        />
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
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
