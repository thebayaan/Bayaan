import React from 'react';
import {TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useLoved} from '@/hooks/useLoved';
import {HeartIcon} from '@/components/Icons';

export const LoveButton = () => {
  const {theme} = useTheme();
  const {queue} = useUnifiedPlayer();
  const {isTrackLoved, toggleTrackLoved} = useLoved();
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];

  const handleToggleLoved = () => {
    if (currentTrack) {
      toggleTrackLoved(currentTrack);
    }
  };

  const isLoved = currentTrack ? isTrackLoved(currentTrack) : false;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleToggleLoved}
      activeOpacity={0.7}>
      <HeartIcon
        size={moderateScale(32)}
        color={theme.colors.text}
        filled={isLoved}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
