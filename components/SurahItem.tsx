import React from 'react';
import {View, Text, Pressable, GestureResponderEvent} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Surah} from '@/data/surahData';
import {HeartIcon} from '@/components/Icons';
import {Icon} from '@rneui/themed';
import {Ionicons} from '@expo/vector-icons';
import Color from 'color';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';
import * as Haptics from 'expo-haptics';
import {usePlayerStore} from '@/services/player/store/playerStore';

import {NowPlayingIndicator} from './NowPlayingIndicator';
import {
  useDownloadProgress,
  useIsDownloaded,
  useIsDownloadedWithRewayat,
  useIsDownloading,
} from '@/services/player/store/downloadSelectors';
import {CircularProgress} from '@/components/CircularProgress';
import {GradientText} from '@/components/GradientText';

interface SurahItemProps {
  item: Surah;
  onPress: (item: Surah) => void;
  reciterId?: string;
  isLoved?: boolean;
  isDownloaded?: boolean;
  onOptionsPress?: (item: Surah) => void;
  enableHaptics?: boolean;
  rewayatId?: string;
  rewayatName?: string;
}

export const SurahItem: React.FC<SurahItemProps> = React.memo(
  ({
    item,
    onPress,
    reciterId,
    isLoved = false,
    onOptionsPress,
    enableHaptics = false,
    rewayatId,
    rewayatName,
  }) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const downloadId = React.useMemo(
      () =>
        reciterId
          ? rewayatId
            ? `${reciterId}-${item.id}-${rewayatId}`
            : `${reciterId}-${item.id}`
          : '__none__',
      [reciterId, item.id, rewayatId],
    );

    // Calculate download state - use isDownloadedWithRewayat if rewayatId is provided, otherwise use checkIsDownloaded
    const isDownloadedBase = useIsDownloaded(
      reciterId || '__none__',
      item.id.toString(),
    );
    const isDownloadedRewayat = useIsDownloadedWithRewayat(
      reciterId || '__none__',
      item.id.toString(),
      rewayatId || '',
    );
    const isDownloadedState = rewayatId
      ? isDownloadedRewayat
      : isDownloadedBase;

    // Check if currently downloading - use isDownloadingWithRewayat if rewayatId is provided
    const isCurrentlyDownloading = useIsDownloading(downloadId);

    // Get download progress
    const downloadProgress = useDownloadProgress(downloadId);

    // Get necessary state slices from player store
    const playbackStatus = usePlayerStore(state => state.playback.state);
    const currentIndex = usePlayerStore(state => state.queue.currentIndex);
    const tracks = usePlayerStore(state => state.queue.tracks);

    // Determine if this specific item is currently playing
    const isCurrentlyPlaying = React.useMemo(() => {
      // Check if playback is active
      const isActive =
        playbackStatus === 'playing' || playbackStatus === 'buffering';

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

    // Check if this is the current track (regardless of play state)
    const isCurrentTrack = React.useMemo(() => {
      const currentTrack =
        tracks && currentIndex >= 0 && currentIndex < tracks.length
          ? tracks[currentIndex]
          : null;

      if (!reciterId || !currentTrack) return false;

      const rewayatMatches =
        rewayatId && currentTrack.rewayatId
          ? rewayatId === currentTrack.rewayatId
          : true;

      return (
        currentTrack.reciterId === reciterId &&
        currentTrack.surahId === item.id.toString() &&
        rewayatMatches
      );
    }, [reciterId, item.id, rewayatId, currentIndex, tracks]);

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

    const revelationPlace = item.revelation_place.toLowerCase() as
      | 'makkah'
      | 'madinah';

    return (
      <View style={styles.surahItem}>
        {/* Left zone - Play action */}
        <Pressable
          style={styles.playZone}
          onPress={handlePress}
          onLongPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`Surah ${item.name}, ${
            item.translated_name_english
          }, ${item.verses_count} verses${
            isCurrentlyPlaying ? ', currently playing' : ''
          }`}
          accessibilityHint="Tap to play Surah">
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
              {isCurrentTrack ? (
                <GradientText
                  style={styles.surahName}
                  surahId={Number(item.id)}>
                  {`${item.id}. ${item.name}`}
                </GradientText>
              ) : (
                <Text
                  style={styles.surahName}>{`${item.id}. ${item.name}`}</Text>
              )}
              {isLoved && (
                <HeartIcon
                  size={moderateScale(14)}
                  color={theme.colors.text}
                  filled={true}
                />
              )}
            </View>
            <View style={styles.secondaryInfoContainer}>
              {isCurrentlyDownloading ? (
                <CircularProgress
                  progress={downloadProgress}
                  size={moderateScale(12)}
                  strokeWidth={moderateScale(1.5)}
                  color={theme.colors.textSecondary}
                />
              ) : isDownloadedState ? (
                <Ionicons
                  name="arrow-down-circle"
                  size={moderateScale(12)}
                  color={theme.colors.textSecondary}
                  style={styles.downloadIcon}
                />
              ) : null}
              <Text style={styles.surahSecondaryInfo}>
                {item.translated_name_english}
              </Text>
            </View>
            {rewayatName ? (
              <Text style={styles.rewayatText}>{rewayatName}</Text>
            ) : (
              <View
                style={[
                  styles.locationIndicator,
                  {
                    backgroundColor: Color(theme.colors.card)
                      .alpha(0.8)
                      .toString(),
                  },
                ]}>
                {revelationPlace === 'makkah' ? (
                  <MakkahIcon
                    size={moderateScale(13)}
                    color={theme.colors.textSecondary}
                    secondaryColor={Color(theme.colors.card)
                      .alpha(0.8)
                      .toString()}
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
            )}
          </View>
        </Pressable>

        {/* Right zone - Options action */}
        {onOptionsPress && (
          <Pressable
            style={styles.optionsZone}
            onPress={handleOptionsPress}
            accessibilityRole="button"
            accessibilityLabel="More options"
            accessibilityHint="Opens menu with additional actions for this Surah">
            {isCurrentTrack ? (
              <NowPlayingIndicator
                isPlaying={
                  playbackStatus === 'playing' || playbackStatus === 'buffering'
                }
                barCount={3}
                surahId={Number(item.id)}
              />
            ) : (
              <Icon
                name="more-horizontal"
                type="feather"
                size={moderateScale(18)}
                color={theme.colors.text}
              />
            )}
          </Pressable>
        )}
      </View>
    );
  },
);

SurahItem.displayName = 'SurahItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    surahItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    playZone: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      paddingLeft: moderateScale(12),
    },
    optionsZone: {
      width: '20%',
      minWidth: moderateScale(50),
      maxWidth: moderateScale(70),
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(8),
      paddingRight: moderateScale(12),
      alignSelf: 'stretch',
    },
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
    rewayatText: {
      fontSize: moderateScale(10),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
  });
