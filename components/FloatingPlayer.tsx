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
import {usePlayerColors} from '@/hooks/usePlayerColors';
import {LinearGradient} from 'expo-linear-gradient';
import {StyleSheet} from 'react-native';
import {usePlayerStore} from '@/store/playerStore';
import {usePrevious} from '@/hooks/usePrevious';

export const FloatingPlayer: React.FC = () => {
  const {theme} = useTheme();
  const playbackState = usePlaybackState();
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const isLoading = usePlayerStore(state => state.isLoading);
  const updateCurrentTrack = usePlayerStore(state => state.updateCurrentTrack);
  const previousTrack = usePrevious(currentTrack);
  const displayTrack = currentTrack || previousTrack;

  const styles = createStyles(theme);
  const playerColors = usePlayerColors();

  // Animation values
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);
  const isVisible = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{translateY: translateY.value}],
      opacity: opacity.value,
    };
  }, []);

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

  const showPlayer = useCallback(() => {
    'worklet';
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 100,
    });
    opacity.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
    isVisible.value = true;
  }, [translateY, opacity, isVisible]);

  const hidePlayer = useCallback(() => {
    'worklet';
    translateY.value = withSpring(100, {
      damping: 15,
      stiffness: 100,
    });
    opacity.value = withTiming(0, {
      duration: 150,
      easing: Easing.in(Easing.ease),
    });
    isVisible.value = false;
  }, [translateY, opacity, isVisible]);

  // Handle visibility animations
  useEffect(() => {
    if (displayTrack) {
      showPlayer();
    } else {
      hidePlayer();
    }
  }, [displayTrack, showPlayer, hidePlayer]);

  const surahGlyph = useMemo(() => {
    if (!displayTrack?.surahId) return '';
    return surahGlyphMap[parseInt(displayTrack.surahId, 10)] || '';
  }, [displayTrack?.surahId]);

  // Only hide when animation has completed
  if (!displayTrack && !isVisible.value) {
    return null;
  }

  return displayTrack ? (
    <Animated.View style={[styles.container, animatedStyle]}>
      <LinearGradient
        colors={
          (playerColors?.gradient as [string, string]) || [
            theme.colors.background,
            theme.colors.background,
          ]
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
              <ActivityIndicator
                color={playerColors?.text || theme.colors.text}
              />
            ) : playbackState.state === State.Playing ? (
              <PauseIcon
                color={playerColors?.text || theme.colors.text}
                size={moderateScale(26)}
              />
            ) : (
              <PlayIcon
                color={playerColors?.text || theme.colors.text}
                size={moderateScale(30)}
              />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              {color: playerColors?.text || theme.colors.text},
              isLoading && styles.loadingText,
            ]}
            numberOfLines={1}>
            {displayTrack?.title || previousTrack?.title}
          </Text>
          <Text
            style={[
              styles.artist,
              {color: playerColors?.text || theme.colors.text, opacity: 0.7},
              isLoading && styles.loadingText,
            ]}
            numberOfLines={1}>
            {displayTrack?.artist || previousTrack?.artist}
          </Text>
        </View>
        <Text
          style={[
            styles.surahName,
            {color: playerColors?.text || theme.colors.text},
          ]}>
          {surahGlyph}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  ) : null;
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      position: 'absolute',
      bottom: 105,
      left: moderateScale(10),
      right: moderateScale(10),
      borderRadius: moderateScale(22),
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
