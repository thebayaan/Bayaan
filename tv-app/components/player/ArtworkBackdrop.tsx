// tv-app/components/player/ArtworkBackdrop.tsx
import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, View} from 'react-native';
import {colors} from '../../theme/colors';

type Props = {imageUrl: string | null};

export function ArtworkBackdrop({imageUrl}: Props): React.ReactElement {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {imageUrl ? (
        <Image
          source={{uri: imageUrl}}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          blurRadius={40}
          cachePolicy="memory-disk"
          priority="high"
        />
      ) : null}
      <View style={[StyleSheet.absoluteFillObject, styles.scrim]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {backgroundColor: colors.overlayScrim},
});
