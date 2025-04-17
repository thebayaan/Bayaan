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
import {getRandomTrack} from '@/utils/randomRecitation';
import {usePlayerStore} from '@/store/playerStore';
import * as Haptics from 'expo-haptics';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
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
  const isLoading = usePlayerStore(state => state.isLoading);

  // Get the player hooks
  const {updateQueue, play} = useUnifiedPlayer();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const queueContext = QueueContext.getInstance();

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
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handleRandomPlay = useCallback(async () => {
    try {
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Show initial toast
      showToast('Finding a random recitation...');

      // Get a random track
      const {reciter, surah} = await getRandomTrack();

      // Show what's being played
      showToast(`Playing ${surah.name} by ${reciter.name}`);

      // Get selected rewayat (use the first one for simplicity)
      const selectedRewayat = reciter.rewayat[0];

      // Create track for the random selection
      const tracks = await createTracksForReciter(
        reciter,
        [surah],
        selectedRewayat.id,
      );

      // Update queue and play
      await updateQueue(tracks, 0);
      await play();

      // Add to recent tracks
      await addRecentTrack(reciter, surah, 0, 0, selectedRewayat.id);

      // Set current reciter in queue context
      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      console.error('Error playing random recitation:', error);
      showToast('Failed to play random recitation. Please try again.');
    }
  }, [updateQueue, play, addRecentTrack, queueContext]);

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
      // borderRadius: moderateScale(20),
      // backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      // marginRight: moderateScale(12),
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontFamily: 'Manrope-Bold',
      fontSize: moderateScale(8),
      letterSpacing: moderateScale(0.5),
      color: theme.colors.textSecondary,
      marginBottom: verticalScale(2),
    },
    subtitle: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(11),
      color: theme.colors.text,
    },
  });
