import React, {useEffect, useMemo} from 'react';
import {View, Text, TouchableOpacity, Image, Dimensions} from 'react-native';
import {Slider} from '@miblanchard/react-native-slider';
import {Icon} from '@rneui/themed';
import {useRouter, usePathname} from 'expo-router';
import {useAudioPlayerContext} from '@/contexts/AudioPlayerContext';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {ViewStyle} from 'react-native';
const PLACEHOLDER_IMAGE = require('@/assets/images/placeholder_album_art.jpg');
const {height: SCREEN_HEIGHT} = Dimensions.get('window');

const BOTTOM_TAB_HEIGHT = 85;
const FLOATING_PLAYER_HEIGHT = 70;

export const FloatingPlayer: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const {currentTrack, isPlaying, togglePlayback, progress, seekTo} =
    useAudioPlayerContext();
  const translateY = useSharedValue(0);
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{translateY: translateY.value}],
    };
  });

  useEffect(() => {
    if (pathname === '/audio-player') {
      translateY.value = withTiming(-SCREEN_HEIGHT, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
    } else {
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
    }
  }, [pathname, translateY]);

  const getIcon = useMemo(
    () => (name: 'play' | 'pause') => {
      const iconConfig = {
        play: {type: 'foundation', name: 'play', color: theme.colors.text},
        pause: {type: 'foundation', name: 'pause', color: theme.colors.text},
      };

      return {
        ...iconConfig[name],
        size: moderateScale(24),
      };
    },
    [theme.colors.text],
  );

  if (!currentTrack) return null;

  const handlePress = () => {
    console.log('FloatingPlayer handlePress called', {
      surahId: parseInt(currentTrack.id, 10),
      currentPosition: progress.position,
    });
    router.push('/audio-player');
  };

  return (
    <Animated.View style={[styles.container, animatedStyles]}>
      <TouchableOpacity style={styles.content} onPress={handlePress}>
        <Image source={PLACEHOLDER_IMAGE} style={styles.albumArt} />
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>
        <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
          <Icon {...getIcon(isPlaying ? 'pause' : 'play')} />
        </TouchableOpacity>
      </TouchableOpacity>
      <View style={styles.sliderContainer}>
        <Slider
          value={progress.position}
          minimumValue={0}
          maximumValue={progress.duration}
          minimumTrackTintColor={theme.colors.primary}
          maximumTrackTintColor="rgba(255,255,255,0.3)"
          thumbStyle={styles.sliderThumb as ViewStyle}
          trackStyle={styles.sliderTrack as ViewStyle}
          onSlidingComplete={values => {
            const newPosition = values[0];
            seekTo(newPosition);
          }}
        />
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'column',
      backgroundColor: theme.colors.secondary,
      padding: moderateScale(theme.spacing.unit),
      height: moderateScale(FLOATING_PLAYER_HEIGHT),
      position: 'absolute',
      bottom: moderateScale(BOTTOM_TAB_HEIGHT),
      left: 0,
      right: 0,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: moderateScale(-5),
    },
    albumArt: {
      width: moderateScale(50),
      height: moderateScale(50),
      marginRight: moderateScale(theme.spacing.unit),
      marginTop: moderateScale(-5),
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontSize: theme.typography.bodySize,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text,
      paddingBottom: moderateScale(theme.spacing.unit / 2),
    },
    artist: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    playButton: {
      padding: moderateScale(theme.spacing.unit),
    },
    sliderContainer: {
      marginBottom: moderateScale(-25),
      marginTop: moderateScale(-20),
    },
    sliderTrack: {
      height: moderateScale(2),
      backgroundColor: theme.colors.light,
    },
    sliderThumb: {
      width: 0,
      height: 0,
    },
  });
