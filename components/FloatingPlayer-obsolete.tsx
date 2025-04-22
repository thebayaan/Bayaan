import React, {useCallback, useEffect} from 'react';
import {View, Text, Pressable} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {State as TrackPlayerState} from 'react-native-track-player';
import Animated, {
  useSharedValue,
  withTiming,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import PlaybackControls from '@/components/player/PlaybackControls-obsolete';
import {usePlayerColors} from '@/hooks/usePlayerColors';
import {LinearGradient} from 'expo-linear-gradient';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';

export const FloatingPlayer: React.FC = () => {
  const {theme} = useTheme();
  const {playback, queue, loading, play, pause, sheetMode, setSheetMode} =
    useUnifiedPlayer();

  const currentTrack = queue?.tracks?.[queue.currentIndex];
  const shouldShow =
    !loading?.stateRestoring && !!currentTrack && sheetMode === 'hidden';

  const styles = createStyles(theme);
  const playerColors = usePlayerColors();

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}],
    opacity: opacity.value,
  }));

  const showPlayer = useCallback(() => {
    'worklet';
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(1, {
      duration: 200,
    });
  }, [translateY, opacity]);

  const hidePlayer = useCallback(() => {
    'worklet';
    translateY.value = withSpring(100, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(0, {
      duration: 200,
    });
  }, [translateY, opacity]);

  useEffect(() => {
    if (shouldShow) {
      showPlayer();
    } else {
      hidePlayer();
    }
  }, [shouldShow, showPlayer, hidePlayer]);

  const onPress = useCallback(() => {
    setSheetMode('full');
  }, [setSheetMode]);

  if (!currentTrack) {
    return null;
  }

  const gradientColors = playerColors
    ? ([
        playerColors.gradientStart,
        playerColors.gradientMiddle,
        playerColors.gradientEnd,
      ] as const)
    : ([theme.colors.card, theme.colors.card, theme.colors.card] as const);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <Pressable onPress={onPress} style={styles.content}>
          <View style={styles.trackInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>
          <View style={styles.controls}>
            <PlaybackControls
              surahId={currentTrack.surahId ?? ''}
              isPlaying={playback.state === TrackPlayerState.Playing}
              onPlayPause={() =>
                playback.state === TrackPlayerState.Playing ? pause() : play()
              }
            />
          </View>
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      position: 'absolute',
      bottom: moderateScale(70),
      left: moderateScale(16),
      right: moderateScale(16),
      zIndex: 1000,
    },
    gradient: {
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      padding: moderateScale(12),
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    trackInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    title: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      opacity: 0.7,
    },
    controls: {
      width: moderateScale(40),
      height: moderateScale(40),
      borderRadius: moderateScale(20),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
  });
