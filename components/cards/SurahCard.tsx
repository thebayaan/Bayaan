import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {LinearGradient} from 'expo-linear-gradient';
import Color from 'color';
import {MakkahIcon, MadinahIcon, HeartIcon} from '@/components/Icons';
import {Ionicons, Feather} from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {Link} from 'expo-router';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';

import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {GradientText} from '@/components/GradientText';
import {
  useIsDownloaded,
  useIsDownloadedWithRewayat,
} from '@/services/player/store/downloadSelectors';

interface SurahCardProps {
  id: number;
  name: string;
  translatedName: string;
  versesCount: number;
  revelationPlace: string;
  color: string;
  onPress: () => void;
  onLongPress?: () => void;
  onOptionsPress?: () => void;
  style?: StyleProp<ViewStyle>;
  isLoved?: boolean;
  isDownloaded?: boolean;
  isLoading?: boolean;
  enableHaptics?: boolean;
  enableAnimation?: boolean;
  reciterId?: string;
  rewayatId?: string;
  mushafLink?: boolean;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const SurahCard: React.FC<SurahCardProps> = ({
  id,
  name,
  translatedName,
  revelationPlace,
  color,
  onPress,
  onLongPress,
  onOptionsPress,
  style,
  isLoved = false,
  isDownloaded = false,
  enableHaptics = false,
  enableAnimation = false,
  reciterId,
  rewayatId,
  mushafLink = false,
}) => {
  const {theme} = useTheme();
  const glassColorScheme = useGlassColorScheme();

  // Get download state
  const isDownloadedBase = useIsDownloaded(
    reciterId || '__none__',
    id.toString(),
  );
  const isDownloadedRewayat = useIsDownloadedWithRewayat(
    reciterId || '__none__',
    id.toString(),
    rewayatId || '',
  );

  // Calculate actual download state - use isDownloadedWithRewayat if rewayatId is provided
  const isActuallyDownloaded = reciterId
    ? rewayatId
      ? isDownloadedRewayat
      : isDownloadedBase
    : isDownloaded; // Fallback to prop if no reciterId

  // Get necessary state slices from player store
  const playbackStatus = usePlayerStore(state => state.playback.state);
  const currentIndex = usePlayerStore(state => state.queue.currentIndex);
  const tracks = usePlayerStore(state => state.queue.tracks);

  // Check if this specific track is playing
  const isCurrentTrack = React.useMemo(() => {
    // Get current track
    const currentTrack =
      tracks && currentIndex >= 0 && currentIndex < tracks.length
        ? tracks[currentIndex]
        : null;

    // Check if this is the active track (regardless of play state)
    if (!reciterId || !currentTrack) return false;

    // For the same reciter and surah, we need to also check rewayatId if present
    const rewayatMatches =
      rewayatId && currentTrack.rewayatId
        ? rewayatId === currentTrack.rewayatId
        : true;

    return (
      currentTrack.reciterId === reciterId &&
      currentTrack.surahId === id.toString() &&
      rewayatMatches
    );
  }, [reciterId, id, rewayatId, currentIndex, tracks]);

  // --- Conditional Animation Setup ---
  const scale = useSharedValue(enableAnimation ? 1 : 1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: enableAnimation ? [{scale: scale.value}] : [],
  }));

  const handlePressIn = () => {
    if (enableAnimation) {
      scale.value = withSpring(0.95, {
        damping: 20,
        stiffness: 400,
        mass: 0.5,
      });
    }
  };

  const handlePressOut = () => {
    if (enableAnimation) {
      scale.value = withSpring(1, {
        damping: 20,
        stiffness: 400,
        mass: 0.5,
      });
    }
  };
  // --- End Conditional Animation Setup ---

  const handleCardPress = () => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const gradientColors = React.useMemo((): [string, string] => {
    const baseColor = Color(color);
    const gradientStart = baseColor.alpha(0.15).toString();
    const gradientEnd = baseColor.alpha(0.05).toString();
    return [gradientStart, gradientEnd];
  }, [color]);
  const styles = StyleSheet.create({
    container: {
      width: moderateScale(120),
      height: moderateScale(120),
      borderRadius: moderateScale(20),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(color).alpha(0.15).toString(),
    },
    glassWrapper: {
      height: moderateScale(120),
    },
    glassInner: {
      flex: 1,
      borderRadius: moderateScale(20),
      overflow: 'hidden',
    },
    content: {
      flex: 1,
      padding: moderateScale(6),
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    arabicName: {
      fontSize: moderateScale(26),
      color: theme.colors.text,
      fontFamily: 'SurahNames',
      marginBottom: moderateScale(2),
      textShadowColor: 'rgba(0, 0, 0, 0.1)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 2,
    },
    nameContainer: {
      alignItems: 'center',
      paddingHorizontal: moderateScale(3),
      width: '100%',
    },
    textBlock: {
      alignItems: 'center',
    },
    name: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
      letterSpacing: 0.2,
    },
    translatedName: {
      fontSize: moderateScale(9),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      opacity: 0.9,
      letterSpacing: 0.1,
    },
    placeIcon: {
      position: 'absolute',
      top: moderateScale(4),
      right: moderateScale(4),
      opacity: 0.8,
      padding: moderateScale(3),
      // backgroundColor: Color(theme.isDarkMode ? '#ffffff' : color)
      //   .alpha(0.08)
      //   .toString(),
      // borderRadius: moderateScale(10),
      // borderWidth: 0.5,
      borderColor: Color(color).alpha(0.2).toString(),
      shadowColor: theme.isDarkMode ? 'transparent' : 'rgba(0,0,0,0.1)',
      shadowOffset: {width: 0, height: 1},
      shadowRadius: 2,
      shadowOpacity: 0.5,
      elevation: 1,
    },
    numberBadge: {
      position: 'absolute',
      top: moderateScale(4),
      left: moderateScale(4),
      // backgroundColor: Color(theme.isDarkMode ? '#ffffff' : color)
      //   .alpha(0.08)
      //   .toString(),
      // paddingHorizontal: moderateScale(4),
      // paddingVertical: 0,
      height: moderateScale(16),
      minWidth: moderateScale(16),
      alignItems: 'center',
      justifyContent: 'center',
      // borderRadius: moderateScale(8),
      // borderWidth: 0.5,
      borderColor: Color(color).alpha(0.2).toString(),
      shadowColor: theme.isDarkMode ? 'transparent' : 'rgba(0,0,0,0.1)',
      shadowOffset: {width: 0, height: 1},
      shadowRadius: 2,
      shadowOpacity: 0.5,
      elevation: 1,
    },
    numberText: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    divider: {
      height: 1,
      width: '30%',
      backgroundColor: Color(color).alpha(0.15).toString(),
      marginVertical: moderateScale(2),
    },
    heartIconContainer: {
      position: 'absolute',
      bottom: verticalScale(5),
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(4),
    },
    optionsButton: {
      position: 'absolute',
      bottom: moderateScale(6),
      right: moderateScale(6),
      padding: moderateScale(2),
      borderRadius: moderateScale(8),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
    },
    nowPlayingContainer: {
      position: 'absolute',
      bottom: moderateScale(6),
      right: moderateScale(6),
      width: moderateScale(24),
      height: moderateScale(24),
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const handleOptionsPressWrapper = (e: GestureResponderEvent) => {
    e.stopPropagation();
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onOptionsPress?.();
  };

  const handleLongPressWrapper = () => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (onLongPress) {
      onLongPress();
    } else {
      onOptionsPress?.();
    }
  };

  // Choose Touchable component based on animation prop
  const TouchableComponent = enableAnimation
    ? AnimatedTouchableOpacity
    : TouchableOpacity;

  const cardContent = (
    <>
      <LinearGradient
        colors={gradientColors as [string, string]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.placeIcon}>
        {revelationPlace.toLowerCase() === 'makkah' ? (
          <MakkahIcon
            size={moderateScale(15)}
            color={Color(theme.colors.text).alpha(0.9).toString()}
            secondaryColor={theme.colors.background}
          />
        ) : (
          <MadinahIcon
            size={moderateScale(15)}
            color={Color(theme.colors.text).alpha(0.9).toString()}
          />
        )}
      </View>
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{id}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.arabicName}>{surahGlyphMap[id]}</Text>
        <View style={styles.divider} />
        <View style={styles.nameContainer}>
          <View style={styles.textBlock}>
            {isCurrentTrack ? (
              <GradientText style={styles.name} surahId={id}>
                {name}
              </GradientText>
            ) : (
              <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                {name}
              </Text>
            )}
            <Text
              style={styles.translatedName}
              numberOfLines={1}
              ellipsizeMode="tail">
              {translatedName}
            </Text>
          </View>
        </View>

        <View style={styles.heartIconContainer}>
          {isLoved && (
            <HeartIcon
              size={moderateScale(14)}
              color={theme.colors.text}
              filled={true}
            />
          )}
          {isActuallyDownloaded && (
            <Ionicons
              name="arrow-down-circle"
              size={moderateScale(14)}
              color={theme.colors.textSecondary}
            />
          )}
        </View>
      </View>

      {/* Conditional Rendering: NowPlayingIndicator or Options Button */}
      {isCurrentTrack ? (
        <TouchableOpacity
          style={styles.nowPlayingContainer}
          onPress={onOptionsPress ? handleOptionsPressWrapper : undefined}
          activeOpacity={0.7}>
          <NowPlayingIndicator
            isPlaying={
              playbackStatus === 'playing' || playbackStatus === 'buffering'
            }
            barCount={3}
            surahId={id}
          />
        </TouchableOpacity>
      ) : (
        onOptionsPress && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={handleOptionsPressWrapper}
            activeOpacity={0.7}>
            <Feather
              name="more-horizontal"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        )
      )}
    </>
  );

  if (mushafLink && USE_GLASS) {
    return (
      <Link
        href={{
          pathname: '/mushaf',
          params: {surah: id.toString()},
        }}
        asChild>
        <Pressable
          onLongPress={
            onLongPress || onOptionsPress ? handleLongPressWrapper : undefined
          }
          delayLongPress={500}
          style={StyleSheet.flatten([styles.glassWrapper, style])}>
          <Link.AppleZoom>
            <GlassView
              style={styles.glassInner}
              glassEffectStyle="regular"
              colorScheme={glassColorScheme}>
              {cardContent}
            </GlassView>
          </Link.AppleZoom>
        </Pressable>
      </Link>
    );
  }

  if (mushafLink) {
    return (
      <Link
        href={{
          pathname: '/mushaf',
          params: {surah: id.toString()},
        }}
        asChild>
        <Pressable
          onLongPress={
            onLongPress || onOptionsPress ? handleLongPressWrapper : undefined
          }
          delayLongPress={500}
          style={StyleSheet.flatten([styles.container, style])}>
          {cardContent}
        </Pressable>
      </Link>
    );
  }

  if (USE_GLASS) {
    return (
      <Pressable
        onPress={handleCardPress}
        onLongPress={
          onLongPress || onOptionsPress ? handleLongPressWrapper : undefined
        }
        delayLongPress={500}
        style={StyleSheet.flatten([styles.glassWrapper, style])}>
        <GlassView
          style={styles.glassInner}
          glassEffectStyle="regular"
          colorScheme={glassColorScheme}>
          {cardContent}
        </GlassView>
      </Pressable>
    );
  }

  return (
    <TouchableComponent
      activeOpacity={1}
      style={
        enableAnimation
          ? [styles.container, animatedStyle, style]
          : [styles.container, style]
      }
      onPress={handleCardPress}
      onLongPress={
        onLongPress || onOptionsPress ? handleLongPressWrapper : undefined
      }
      delayLongPress={500}
      onPressIn={enableAnimation ? handlePressIn : undefined}
      onPressOut={enableAnimation ? handlePressOut : undefined}>
      {cardContent}
    </TouchableComponent>
  );
};
