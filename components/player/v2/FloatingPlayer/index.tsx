import React, {useCallback, useEffect, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet, Platform} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import Animated, {
  useSharedValue,
  withTiming,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {PlayButton} from './PlayButton';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {useLoved} from '@/hooks/useLoved';
import {HeartIcon, MicrophoneIcon} from '@/components/Icons';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {BlurView} from '@react-native-community/blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getFloatingPlayerBottomPosition} from '@/utils/constants';

// Create styles as a function that takes insets
const createStyles = (bottomInset: number) =>
  ScaledSheet.create({
    container: {
      position: 'absolute',
      bottom: getFloatingPlayerBottomPosition(bottomInset),
      left: moderateScale(10),
      right: moderateScale(10),
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    background: {
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      borderWidth: 0.1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.85,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: moderateScale(10),
      paddingHorizontal: moderateScale(15),
    },
    playButtonContainer: {
      width: moderateScale(10),
      height: moderateScale(10),
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: moderateScale(10),
    },
    trackInfo: {
      flex: 1,
      marginHorizontal: moderateScale(20),
    },
    title: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Bold',
    },
    subtitle: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      opacity: 0.85,
    },
    rightControls: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    loveButton: {
      padding: moderateScale(4),
    },
    surahGlyph: {
      fontFamily: 'SurahNames',
      fontSize: moderateScale(20),
      textAlign: 'center',
    },
    surahGlyphContainer: {
      width: moderateScale(55),
      height: moderateScale(30),
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    androidBackground: {
      elevation: 10,
      borderWidth: 0.5,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
  });

export const FloatingPlayer: React.FC = React.memo(function FloatingPlayer() {
  const {theme} = useTheme();
  const {play, pause, setSheetMode} = usePlayerActions();
  const playbackState = usePlayerStore(state => state.playback.state);
  const queueTracks = usePlayerStore(state => state.queue.tracks);
  const currentIndex = usePlayerStore(state => state.queue.currentIndex);
  const trackLoading = usePlayerStore(state => state.loading.trackLoading);
  const stateRestoring = usePlayerStore(state => state.loading.stateRestoring);
  const {isTrackLoved, toggleTrackLoved} = useLoved();
  const scale = useSharedValue(1);
  const heartScale = useSharedValue(1);
  const insets = useSafeAreaInsets();
  // Create styles using insets
  const styles = useMemo(() => createStyles(insets.bottom), [insets.bottom]);

  const currentTrack = useMemo(
    () => queueTracks?.[currentIndex],
    [queueTracks, currentIndex],
  );

  const prevTrackIdRef = React.useRef<string | null>(null);

  // Show loading only when loading a new track, not during play/pause
  const isLoadingNewTrack = useMemo(() => {
    const isTrackChanging = currentTrack?.id !== prevTrackIdRef.current;
    if (currentTrack?.id) {
      prevTrackIdRef.current = currentTrack.id;
    }

    // Only show loading when:
    // 1. A track is being loaded (trackLoading) AND it's a new track
    // 2. OR when in the initial buffering state (but not during play/pause)
    return (trackLoading && isTrackChanging) || playbackState === 'buffering';
  }, [trackLoading, playbackState, currentTrack?.id]);

  const shouldShow = useMemo(
    () => !stateRestoring && !!currentTrack,
    [stateRestoring, currentTrack],
  );

  const surahNumber = useMemo(() => {
    if (!currentTrack?.surahId) return undefined;
    return parseInt(currentTrack.surahId, 10);
  }, [currentTrack?.surahId]);

  const surahGlyph = useMemo(() => {
    if (!surahNumber) return '';
    return surahGlyphMap[surahNumber];
  }, [surahNumber]);

  // Animation values
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}, {scale: scale.value}],
    opacity: opacity.value,
  }));

  // Animation handlers
  const showPlayer = useCallback(() => {
    'worklet';
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(1, {
      duration: 200,
    });
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 150,
    });
  }, [translateY, opacity, scale]);

  const hidePlayer = useCallback(() => {
    'worklet';
    translateY.value = withSpring(100, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(0, {
      duration: 200,
    });
    scale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 150,
    });
  }, [translateY, opacity, scale]);

  // Handle visibility
  useEffect(() => {
    if (shouldShow) {
      showPlayer();
    } else {
      hidePlayer();
    }
  }, [shouldShow, showPlayer, hidePlayer]);

  const handlePress = useCallback(() => {
    setSheetMode('full');
  }, [setSheetMode]);

  const handlePlayPause = useCallback(async () => {
    if (playbackState === 'playing') {
      await pause();
    } else {
      await play();
    }
  }, [playbackState, pause, play]);

  const handleLovePress = useCallback(() => {
    if (currentTrack) {
      // Animate the heart
      heartScale.value = withSpring(1.2, {}, () => {
        heartScale.value = withSpring(1);
      });

      toggleTrackLoved(currentTrack);
    }
  }, [currentTrack, toggleTrackLoved, heartScale]);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: heartScale.value}],
  }));

  if (!currentTrack) {
    return null;
  }

  const textColor = theme.colors.text;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          blurAmount={80}
          blurType={theme.isDarkMode ? 'dark' : 'light'}
          style={styles.background}>
          <View
            style={[styles.overlay, {backgroundColor: theme.colors.card}]}
          />
          <Pressable
            onPress={handlePress}
            style={styles.content}
            android_ripple={{color: 'rgba(0, 0, 0, 0.1)'}}
            unstable_pressDelay={0}>
            <View style={styles.playButtonContainer}>
              {isLoadingNewTrack ? (
                <LoadingIndicator color={textColor} />
              ) : (
                <PlayButton
                  isPlaying={playbackState === 'playing'}
                  onPlayPause={handlePlayPause}
                  disabled={isLoadingNewTrack}
                />
              )}
            </View>
            <View style={styles.trackInfo}>
              <Text
                style={[styles.title, {color: textColor}]}
                numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text
                style={[styles.subtitle, {color: textColor}]}
                numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
            <View style={styles.rightControls}>
              <Pressable
                onPress={handleLovePress}
                style={({pressed}) => [
                  styles.loveButton,
                  {opacity: pressed ? 0.7 : 1},
                ]}>
                <Animated.View style={heartAnimatedStyle}>
                  <HeartIcon
                    color={isTrackLoved(currentTrack) ? 'red' : textColor}
                    size={moderateScale(24)}
                    filled={isTrackLoved(currentTrack)}
                  />
                </Animated.View>
              </Pressable>
              <View style={styles.surahGlyphContainer}>
                {currentTrack?.isUserUpload && !surahGlyph ? (
                  <MicrophoneIcon size={moderateScale(20)} color={textColor} />
                ) : (
                  <Text style={[styles.surahGlyph, {color: textColor}]}>
                    {surahGlyph}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        </BlurView>
      ) : (
        <View
          style={[
            styles.background,
            styles.androidBackground,
            {backgroundColor: theme.colors.card},
          ]}>
          <Pressable
            onPress={handlePress}
            style={styles.content}
            android_ripple={{color: 'rgba(0, 0, 0, 0.1)'}}
            unstable_pressDelay={0}>
            <View style={styles.playButtonContainer}>
              {isLoadingNewTrack ? (
                <LoadingIndicator color={textColor} />
              ) : (
                <PlayButton
                  isPlaying={playbackState === 'playing'}
                  onPlayPause={handlePlayPause}
                  disabled={isLoadingNewTrack}
                />
              )}
            </View>
            <View style={styles.trackInfo}>
              <Text
                style={[styles.title, {color: textColor}]}
                numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text
                style={[styles.subtitle, {color: textColor}]}
                numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
            <View style={styles.rightControls}>
              <Pressable
                onPress={handleLovePress}
                style={({pressed}) => [
                  styles.loveButton,
                  {opacity: pressed ? 0.7 : 1},
                ]}>
                <Animated.View style={heartAnimatedStyle}>
                  <HeartIcon
                    color={isTrackLoved(currentTrack) ? 'red' : textColor}
                    size={moderateScale(24)}
                    filled={isTrackLoved(currentTrack)}
                  />
                </Animated.View>
              </Pressable>
              <View style={styles.surahGlyphContainer}>
                {currentTrack?.isUserUpload && !surahGlyph ? (
                  <MicrophoneIcon size={moderateScale(20)} color={textColor} />
                ) : (
                  <Text style={[styles.surahGlyph, {color: textColor}]}>
                    {surahGlyph}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
});
