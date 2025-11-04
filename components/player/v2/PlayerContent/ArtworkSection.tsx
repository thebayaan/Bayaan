import React from 'react';
import {View, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ReciterImage} from '@/components/ReciterImage';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {MAX_PLAYER_CONTENT_HEIGHT} from '@/utils/constants';

export const ArtworkSection = () => {
  const {queue} = useUnifiedPlayer();
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];

  return (
    <View style={styles.container}>
      <ReciterImage
        imageUrl={currentTrack?.artwork}
        reciterName={currentTrack?.artist || ''}
        style={styles.reciterImage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: MAX_PLAYER_CONTENT_HEIGHT,
    maxHeight: MAX_PLAYER_CONTENT_HEIGHT,
    marginTop: moderateScale(5),
    backgroundColor: 'transparent',
  },
  reciterImage: {
    width: '100%',
    height: '100%',
    borderRadius: moderateScale(15),
  },
});
