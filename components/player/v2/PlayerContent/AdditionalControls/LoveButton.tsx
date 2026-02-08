import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useLoved} from '@/hooks/useLoved';
import {HeartIcon} from '@/components/Icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks/useTheme';
export const LoveButton = () => {
  const queue = usePlayerStore(s => s.queue);
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
    <Pressable style={styles.button} onPress={handleToggleLoved}>
      <Animated.View style={animatedStyle}>
        <HeartIcon
          size={moderateScale(32)}
          color={isLoved ? 'red' : theme.colors.text}
          filled={isLoved}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
