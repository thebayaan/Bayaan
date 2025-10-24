import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Surah} from '@/data/surahData';
import {HeartIcon, DownloadIcon} from '@/components/Icons';
import {Icon} from '@rneui/themed';
import {Ionicons} from '@expo/vector-icons';
import Color from 'color';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {State as TrackPlayerState} from 'react-native-track-player';
import {NowPlayingIndicator} from './NowPlayingIndicator';
import {useDownload} from '@/services/player/store/downloadStore';

interface SurahItemProps {
  item: Surah;
  onPress: (item: Surah) => void;
  reciterId?: string;
  isLoved?: boolean;
  isDownloaded?: boolean;
  onOptionsPress?: (item: Surah) => void;
  enableHaptics?: boolean;
  enableAnimation?: boolean;
  rewayatId?: string;
}

// Create Animated component
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const SurahItem: React.FC<SurahItemProps> = React.memo(
  ({
    item,
    onPress,
    reciterId,
    isLoved = false,
    isDownloaded = false,
    onOptionsPress,
    enableHaptics = false,
    enableAnimation = false,
    rewayatId,
  }) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const {isDownloaded: checkIsDownloaded, isDownloadedWithRewayat} = useDownload();

    // Calculate download state - use isDownloadedWithRewayat if rewayatId is provided, otherwise use checkIsDownloaded
    const isDownloadedState = reciterId
      ? rewayatId
        ? isDownloadedWithRewayat(reciterId, item.id.toString(), rewayatId)
        : checkIsDownloaded(reciterId, item.id.toString())
      : false;

    // Get necessary state slices from player store
    const playbackStatus = usePlayerStore(state => state.playback.state);
    const currentIndex = usePlayerStore(state => state.queue.currentIndex);
    const tracks = usePlayerStore(state => state.queue.tracks);

    // Determine if this specific item is currently playing
    const isCurrentlyPlaying = React.useMemo(() => {
      // Check if playback is active
      const isActive =
        playbackStatus === TrackPlayerState.Playing ||
        playbackStatus === TrackPlayerState.Buffering;

      // Ensure valid index and track exists
      const currentTrack =
        tracks && currentIndex >= 0 && currentIndex < tracks.length
          ? tracks[currentIndex]
          : null;

      if (!reciterId || !currentTrack || !isActive) return false;

      // Check if the current track matches this item
      const isCorrectTrack =
        currentTrack.reciterId === reciterId &&
        currentTrack.surahId === item.id.toString();

      return isCorrectTrack; // No need to check isActive again, already done
    }, [reciterId, item.id, playbackStatus, currentIndex, tracks]);

    // Animation value
    const scale = useSharedValue(enableAnimation ? 1 : 1);

    const handlePress = React.useCallback(() => {
      if (enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress(item);
    }, [item, onPress, enableHaptics]);

    const handleOptionsPress = React.useCallback(
      (e?: GestureResponderEvent) => {
        e?.stopPropagation();
        if (enableHaptics) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        if (onOptionsPress) {
          requestAnimationFrame(() => {
            onOptionsPress(item);
          });
        }
      },
      [item, onOptionsPress, enableHaptics],
    );

    const handleLongPressWrapper = () => {
      if (enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      handleOptionsPress();
    };

    // Animation handlers
    const handlePressIn = () => {
      if (enableAnimation) {
        scale.value = withSpring(0.98, {
          damping: 15,
          stiffness: 400,
          mass: 0.5,
        });
      }
    };

    const handlePressOut = () => {
      if (enableAnimation) {
        scale.value = withSpring(1, {
          damping: 15,
          stiffness: 400,
          mass: 0.5,
        });
      }
    };

    // Animated style
    const animatedStyle = useAnimatedStyle(() => ({
      transform: enableAnimation ? [{scale: scale.value}] : [],
    }));

    const revelationPlace = item.revelation_place.toLowerCase() as
      | 'makkah'
      | 'madinah';

    // Choose Touchable component based on animation prop
    const TouchableComponent = enableAnimation
      ? AnimatedTouchableOpacity
      : TouchableOpacity;

    return (
      <TouchableComponent
        activeOpacity={0.99}
        style={[
          styles.surahItem,
          animatedStyle,
          // Optional: Add subtle highlight if playing?
          // isCurrentlyPlaying && styles.playingHighlight,
        ]}
        onPress={handlePress}
        onLongPress={onOptionsPress ? handleLongPressWrapper : undefined}
        delayLongPress={500}
        onPressIn={enableAnimation ? handlePressIn : undefined}
        onPressOut={enableAnimation ? handlePressOut : undefined}
        accessibilityRole="button"
        accessibilityLabel={`Surah ${item.name}, ${item.translated_name_english}, ${item.verses_count} verses${isCurrentlyPlaying ? ', currently playing' : ''}`}
        accessibilityHint={
          onOptionsPress && !isCurrentlyPlaying
            ? 'Tap to view Surah. Long press or tap options button for more actions.'
            : 'Tap to view Surah.'
        }>
        <View
          style={styles.surahGlyphContainer}
          accessibilityElementsHidden={true}>
          <Text
            style={styles.surahGlyph}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {surahGlyphMap[item.id]}
          </Text>
        </View>
        <View
          style={styles.surahInfoContainer}
          accessibilityElementsHidden={true}>
          <View style={styles.nameContainer}>
            <Text style={styles.surahName}>{`${item.id}. ${item.name}`}</Text>
            {isLoved && (
              <HeartIcon
                size={moderateScale(14)}
                color={theme.colors.text}
                filled={true}
              />
            )}
            {isDownloaded && (
              <DownloadIcon
                size={moderateScale(12)}
                color={theme.colors.text}
                filled={true}
              />
            )}
          </View>
          <View style={styles.secondaryInfoContainer}>
            {isDownloadedState && (
              <Ionicons
                name="arrow-down-circle"
                size={moderateScale(12)}
                color={theme.colors.textSecondary}
                style={styles.downloadIcon}
              />
            )}
            <Text style={styles.surahSecondaryInfo}>
              {item.translated_name_english}
            </Text>
          </View>
          <View
            style={[
              styles.locationIndicator,
              {backgroundColor: Color(theme.colors.card).alpha(0.8).toString()},
            ]}>
            {revelationPlace === 'makkah' ? (
              <MakkahIcon
                size={moderateScale(13)}
                color={theme.colors.textSecondary}
                secondaryColor={Color(theme.colors.card).alpha(0.8).toString()}
              />
            ) : (
              <MadinahIcon
                size={moderateScale(13)}
                color={theme.colors.textSecondary}
              />
            )}
            <Text style={styles.locationText}>
              {revelationPlace.charAt(0).toUpperCase() +
                revelationPlace.slice(1)}
            </Text>
          </View>
        </View>
        {/* Conditional Rendering: Indicator or Options Button */}
        <View style={styles.rightActionContainer}>
          {/* Check if this specific track is the current one loaded in the player */}
          {((): boolean => {
            // Get current track
            const currentTrack =
              tracks && currentIndex >= 0 && currentIndex < tracks.length
                ? tracks[currentIndex]
                : null;

            // Check if this is the active track (regardless of play state)
            if (!reciterId || !currentTrack) return false;

            // For the same reciter and surah, we need to also check rewayatId if present
            // This ensures only the exact track being played shows the indicator
            const rewayatMatches =
              // If the component has a rewayatId prop and the current track has a rewayatId,
              // make sure they match
              rewayatId && currentTrack.rewayatId
                ? rewayatId === currentTrack.rewayatId
                : // If component doesn't specify rewayatId, or track doesn't have one,
                  // we'll assume a match based on reciter and surah only
                  true;

            return (
              currentTrack.reciterId === reciterId &&
              currentTrack.surahId === item.id.toString() &&
              rewayatMatches
            );
          })() ? (
            // This is the active track, show NowPlayingIndicator
            <TouchableOpacity
              style={styles.optionsButton}
              onPress={handleOptionsPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="More options"
              accessibilityHint="Opens menu with additional actions for this Surah">
              <NowPlayingIndicator
                isPlaying={
                  playbackStatus === TrackPlayerState.Playing ||
                  playbackStatus === TrackPlayerState.Buffering
                }
                barCount={3}
                surahId={Number(item.id)}
              />
            </TouchableOpacity>
          ) : onOptionsPress ? (
            <TouchableOpacity
              style={styles.optionsButton}
              onPress={handleOptionsPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="More options"
              accessibilityHint="Opens menu with additional actions for this Surah">
              <Icon
                name="more-horizontal"
                type="feather"
                size={moderateScale(18)}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableComponent>
    );
  },
);

SurahItem.displayName = 'SurahItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    surahItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      paddingHorizontal: moderateScale(12),
      backgroundColor: theme.colors.background,
      position: 'relative',
    },
    // playingHighlight: {
    //   backgroundColor: Color(theme.colors.primary).alpha(0.05).toString(),
    // },
    surahGlyphContainer: {
      width: moderateScale(60),
      height: moderateScale(45),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: moderateScale(4),
    },
    surahInfoContainer: {
      flex: 1,
      marginLeft: moderateScale(4),
    },
    nameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    surahName: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    secondaryInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      marginBottom: moderateScale(3),
    },
    surahSecondaryInfo: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    downloadIcon: {
      marginTop: moderateScale(1),
    },
    surahGlyph: {
      fontSize: moderateScale(20),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
      textAlign: 'center',
      width: '100%',
    },
    locationIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(3),
      paddingHorizontal: moderateScale(5),
      paddingVertical: moderateScale(1),
      borderRadius: moderateScale(3),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      alignSelf: 'flex-start',
    },
    locationText: {
      fontSize: moderateScale(9),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    rightActionContainer: {
      width: moderateScale(35),
      height: moderateScale(35),
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: moderateScale(6),
    },
    optionsButton: {
      // Removed padding here, use container size
    },
  });
