import React from 'react';
import {TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useLoved} from '@/hooks/useLoved';
import {HeartIcon} from '@/components/Icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks/useTheme';
export const LoveButton = () => {
  const {queue} = useUnifiedPlayer();
  const {theme} = useTheme();

  const {isTrackLoved, toggleTrackLoved} = useLoved();
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const scale = useSharedValue(1);

  const handleToggleLoved = () => {
    if (currentTrack) {
      // Animate the heart
      scale.value = withSpring(1.2, {}, () => {
        scale.value = withSpring(1);
      });

      toggleTrackLoved(currentTrack);
    }
  };

  const isLoved = currentTrack ? isTrackLoved(currentTrack) : false;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleToggleLoved}
      activeOpacity={0.7}>
      <Animated.View style={animatedStyle}>
        <HeartIcon
          size={moderateScale(32)}
          color={isLoved ? 'red' : theme.colors.text}
          filled={isLoved}
        />
      </Animated.View>
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
