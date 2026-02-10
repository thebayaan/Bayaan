import React, {useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ToastAndroid,
  Platform,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {DiscoverIcon} from '@/components/Icons';
import {getMultipleRandomTracks} from '@/utils/randomRecitation';
import {usePlayerStore} from '@/services/player/store/playerStore';
import * as Haptics from 'expo-haptics';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createTracksForReciter} from '@/utils/track';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {getRandomColors} from '@/utils/gradientColors';
import Color from 'color';
import {Theme} from '@/utils/themeUtils';

// Show toast message with platform awareness
function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
  // On iOS, we could use a custom toast implementation or a library
  // But for simplicity, we'll just log on iOS for now
  console.log(message);
}

interface RandomRecitationHeroProps {
  style?: object;
  gradientColors?: [string, string, string];
  isCompact?: boolean;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

// Use half the height of ScrollingHero
const SECTION_HEIGHT = moderateScale(150);
const RANDOM_HERO_HEIGHT = SECTION_HEIGHT / 2;

export function RandomRecitationHero({
  style,
  isCompact = false,
}: RandomRecitationHeroProps) {
  const {theme} = useTheme();
  const isLoading = usePlayerStore(state => state.loading.trackLoading);

  // Get the player hooks
  const {updateQueue, play} = usePlayerActions();
  const {addRecentTrack} = useRecentlyPlayedStore();

  // Get gradient colors using the shared utility
  const baseColors = useMemo(() => getRandomColors(), []);
  const gradientColors = useMemo(() => {
    // Use the same alpha values as ScrollingHero
    const alpha1 = theme.isDarkMode ? 0.4 : 0.3;
    const alpha2 = theme.isDarkMode ? 0.25 : 0.2;
    const alpha3 = theme.isDarkMode ? 0.15 : 0.1;

    return [
      Color(baseColors[0]).alpha(alpha1).toString(),
      Color(baseColors[1]).alpha(alpha2).toString(),
      Color(baseColors[2]).alpha(alpha3).toString(),
    ] as [string, string, string];
  }, [baseColors, theme.isDarkMode]);

  // Animation values
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: scale.value}],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.98, {
      damping: 20,
      stiffness: 400,
      mass: 0.5,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 20,
      stiffness: 400,
      mass: 0.5,
    });
  };

  const handleRandomPlay = useCallback(async () => {
    try {
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Show initial toast
      showToast('Finding random recitations from different reciters...');

      // Get multiple random tracks with different reciters
      const randomTracks = await getMultipleRandomTracks(15, false);

      if (randomTracks.length === 0) {
        showToast('Failed to find random recitations. Please try again.');
        return;
      }

      // Get the first track to show what's being played
      const {reciter, surah} = randomTracks[0];

      // Show what's being played
      showToast(`Playing ${surah.name} by ${reciter.name}`);

      // Create tracks for all random selections
      const trackPromises = randomTracks.map(item => {
        // Randomly select a rewayah from available options
        const availableRewayat = item.reciter.rewayat.filter(r =>
          r.surah_list.includes(item.surah.id),
        );

        // If no available rewayat includes this surah, fall back to the one with most surahs
        const rewayahToUse =
          availableRewayat.length > 0
            ? availableRewayat[
                Math.floor(Math.random() * availableRewayat.length)
              ]
            : item.reciter.rewayat.reduce(
                (prev, current) =>
                  current.surah_total > prev.surah_total ? current : prev,
                item.reciter.rewayat[0],
              );

        return createTracksForReciter(
          item.reciter,
          [item.surah],
          rewayahToUse.id,
        );
      });

      // Wait for all tracks to be created
      const trackBatches = await Promise.all(trackPromises);

      // Flatten the array of track arrays
      const tracks = trackBatches.flat();

      // Update queue and play
      await updateQueue(tracks, 0);
      await play();

      // Add to recent tracks - use the first randomly selected rewayah for the first track
      const firstRewayah =
        randomTracks[0].reciter.rewayat.filter(r =>
          r.surah_list.includes(randomTracks[0].surah.id),
        )[0] || randomTracks[0].reciter.rewayat[0];

      await addRecentTrack(reciter, surah, 0, 0, firstRewayah.id);
    } catch (error) {
      console.error('Error playing random recitation:', error);
      showToast('Failed to play random recitation. Please try again.');
    }
  }, [updateQueue, play, addRecentTrack]);

  // Dynamic height based on isCompact prop
  const containerHeight = useMemo(
    () => ({
      height: isCompact ? moderateScale(75) : RANDOM_HERO_HEIGHT,
    }),
    [isCompact],
  );

  // Use the styles with theme
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <AnimatedTouchableOpacity
      onPress={handleRandomPlay}
      activeOpacity={1}
      disabled={isLoading}
      style={[styles.container, containerHeight, animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <LinearGradient
        colors={gradientColors}
        start={{x: 0, y: 0.8}}
        end={{x: 1, y: 0.2}}
        style={StyleSheet.absoluteFill}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            {isLoading ? (
              <ActivityIndicator color={theme.colors.text} size="small" />
            ) : (
              <DiscoverIcon
                size={moderateScale(24)}
                color={theme.colors.text}
              />
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>RANDOM RECITATION</Text>
            <Text style={styles.subtitle}>Discover something new</Text>
          </View>
        </View>
      </LinearGradient>
    </AnimatedTouchableOpacity>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      borderRadius: moderateScale(20),
      overflow: 'hidden',
    },
    content: {
      flex: 1,
      padding: moderateScale(14),
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconCircle: {
      width: moderateScale(40),
      height: moderateScale(40),
      justifyContent: 'center',
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontFamily: 'Manrope-Bold',
      fontSize: moderateScale(9),
      letterSpacing: moderateScale(0.5),
      color: theme.colors.text,
      marginBottom: verticalScale(2),
    },
    subtitle: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(11),
      color: theme.colors.text,
    },
  });
