import React, {useEffect, useCallback, useMemo} from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import TrackPlayer, {usePlaybackState, State} from 'react-native-track-player';
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {usePlayerBackground} from '@/hooks/usePlayerBackground';
import {LinearGradient} from 'expo-linear-gradient';
import {StyleSheet} from 'react-native';
import {usePlayerStore} from '@/store/playerStore';
import Color from 'color';
import {usePrevious} from '@/hooks/usePrevious';

export const FloatingPlayer: React.FC = () => {
  const {theme, isDarkMode} = useTheme();
  const playbackState = usePlaybackState();
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const isLoading = usePlayerStore(state => state.isLoading);
  const updateCurrentTrack = usePlayerStore(state => state.updateCurrentTrack);
  const previousTrack = usePrevious(currentTrack);
  const displayTrack = currentTrack || previousTrack;

  const styles = createStyles(theme);
  const {gradientColors} = usePlayerBackground(theme, isDarkMode);

  // Animation values
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(1);

  // Calculate contrasting colors based on background
  const baseColor = Color(gradientColors[0]);
  const contrastColor = baseColor.isLight()
    ? baseColor.darken(0.7).saturate(0.2)
    : baseColor.lighten(3.9).saturate(0.9);

  const secondaryColor = baseColor.isLight()
    ? baseColor.darken(0.8).saturate(0.2)
    : baseColor.lighten(2.2).saturate(1.2);

  const setPlayerSheetVisible = usePlayerStore(
    state => state.setPlayerSheetVisible,
  );

  const handlePress = useCallback(() => {
    // Allow navigation even during loading state
    setPlayerSheetVisible(true);
  }, [setPlayerSheetVisible]);

  const togglePlayback = useCallback(async () => {
    if (isLoading) return;

    try {
      const currentState = await TrackPlayer.getState();
      if (currentState === State.Playing) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      // Reset loading state on error
      usePlayerStore.getState().setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    // Only update current track when playback state changes to Playing
    if (playbackState.state === State.Playing) {
      updateCurrentTrack();
    }
  }, [playbackState.state, updateCurrentTrack]);

  // Add a new effect to handle initial track loading
  useEffect(() => {
    if (!currentTrack) {
      updateCurrentTrack();
    }
  }, [currentTrack, updateCurrentTrack]);

  // Handle visibility animations
  useEffect(() => {
    if (displayTrack) {
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 100,
      });
      opacity.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      });
    } else {
      translateY.value = withSpring(100, {
        damping: 15,
        stiffness: 100,
      });
      opacity.value = withTiming(0, {
        duration: 150,
        easing: Easing.in(Easing.ease),
      });
    }
  }, [displayTrack, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}],
    opacity: opacity.value,
  }));

  const surahGlyph = useMemo(() => {
    if (!displayTrack?.surahId) return '';
    return surahGlyphMap[parseInt(displayTrack.surahId, 10)] || '';
  }, [displayTrack?.surahId]);

  // Only hide when we've never had a track
  if (!displayTrack && !previousTrack) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <LinearGradient
        colors={
          gradientColors?.length === 2
            ? (gradientColors as [string, string])
            : ['#000000', '#000000']
        }
        style={StyleSheet.absoluteFill}
      />
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.content}
        onPress={handlePress}>
        <View style={styles.playButtonContainer}>
          <TouchableOpacity
            activeOpacity={0.99}
            style={[styles.playButton, isLoading && styles.loadingButton]}
            onPress={togglePlayback}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={contrastColor.string()} />
            ) : playbackState.state === State.Playing ? (
              <PauseIcon
                color={contrastColor.string()}
                size={moderateScale(26)}
              />
            ) : (
              <PlayIcon
                color={contrastColor.string()}
                size={moderateScale(30)}
              />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              {color: contrastColor.string()},
              isLoading && styles.loadingText,
            ]}
            numberOfLines={1}>
            {displayTrack?.title || previousTrack?.title}
          </Text>
          <Text
            style={[
              styles.artist,
              {color: secondaryColor.string()},
              isLoading && styles.loadingText,
            ]}
            numberOfLines={1}>
            {displayTrack?.artist || previousTrack?.artist}
          </Text>
        </View>
        <Text style={[styles.surahName, {color: contrastColor.string()}]}>
          {surahGlyph}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      position: 'absolute',
      bottom: 105,
      left: moderateScale(10),
      right: moderateScale(10),
      borderRadius: moderateScale(15),
      paddingHorizontal: moderateScale(15),
      paddingVertical: moderateScale(6),
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      overflow: 'hidden',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    artist: {
      fontSize: moderateScale(14),
      color: theme.colors.text,
    },
    playButton: {
      paddingRight: moderateScale(10),
    },
    playButtonContainer: {
      width: moderateScale(30),
      height: moderateScale(40),
      justifyContent: 'center',
      alignItems: 'center',
    },
    surahName: {
      fontFamily: 'SurahNames',
      fontSize: moderateScale(26),
      color: theme.colors.text,
      alignSelf: 'center',
    },
    loadingButton: {
      opacity: 0.7,
    },
    loadingText: {
      opacity: 0.7,
    },
  });
