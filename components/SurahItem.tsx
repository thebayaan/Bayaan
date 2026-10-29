import React from 'react';
import {View, Text, Pressable, GestureResponderEvent} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Surah} from '@/data/surahData';
import {HeartIcon} from '@/components/Icons';
import {Feather, Ionicons} from '@expo/vector-icons';
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
// @ai-start
import {useTranslation} from 'react-i18next';
import {
  getSurahDisplayName,
  getSurahMeaning,
  localizeDigits,
} from '@/i18n/format';
import {surahRowA11yKeys, type SurahRowPressAction} from '@/utils/surahRowA11y';
import {latinLetterSpacing} from '@/utils/rtl';
// @ai-end

interface SurahItemProps {
  item: Surah;
  onPress: (item: Surah) => void;
  onLongPress?: (item: Surah) => void;
  reciterId?: string;
  isLoved?: boolean;
  isDownloaded?: boolean;
  onOptionsPress?: (item: Surah) => void;
  enableHaptics?: boolean;
  rewayatId?: string;
  rewayatName?: string;
  /** What a tap does on this screen; sets the VoiceOver hint. @ai */
  pressAction?: SurahRowPressAction;
  /**
   * iPad table layout (mockup L9): Revelation and Verses columns replace the
   * place chip, and the text grows. Pair it with SurahTableHeader. @ai
   */
  tableColumns?: boolean;
}

// @ai-start
export const SurahItem: React.FC<SurahItemProps> = React.memo(
  ({
    item,
    onPress,
    onLongPress,
    reciterId,
    isLoved = false,
    onOptionsPress,
    enableHaptics = false,
    rewayatId,
    rewayatName,
    pressAction = 'play', // @ai
    tableColumns = false, // @ai
  }) => {
    const {theme} = useTheme();
    const {t} = useTranslation(['home', 'common']);
    const styles = createStyles(theme);
    const displayName = getSurahDisplayName(item);
    const meaning = getSurahMeaning(item);
    const versesLabel = t('surahItem.verses', {count: item.verses_count});
    const titleText = `${localizeDigits(item.id)}. ${displayName}`;
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

    const handleLongPress = React.useCallback(() => {
      if (enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onLongPress?.(item);
    }, [item, onLongPress, enableHaptics]);

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

    // @ai-start
    const a11yKeys = surahRowA11yKeys({
      pressAction,
      hasLongPress: !!onLongPress,
    });
    // @ai-end

    const revelationPlace = item.revelation_place.toLowerCase() as
      | 'makkah'
      | 'madinah';

    return (
      <View style={styles.surahItem}>
        {/* Left zone - Play action */}
        <Pressable
          style={styles.playZone}
          onPress={handlePress}
          onLongPress={onLongPress ? handleLongPress : undefined}
          accessibilityRole="button"
          accessibilityLabel={[
            t('surahItem.a11yName', {name: displayName}),
            meaning,
            versesLabel,
            isCurrentlyPlaying ? t('surahItem.a11yPlaying') : null,
          ]
            .filter(Boolean)
            .join(t('surahItem.a11ySeparator'))}
          accessibilityHint={t(a11yKeys.hintKey)}
          accessibilityActions={
            a11yKeys.longPressLabelKey
              ? [{name: 'longpress', label: t(a11yKeys.longPressLabelKey)}]
              : undefined
          }
          onAccessibilityAction={e => {
            if (e.nativeEvent.actionName === 'longpress') handleLongPress();
          }}>
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
                  style={[styles.surahName, tableColumns && styles.tableName]}
                  surahId={Number(item.id)}>
                  {titleText}
                </GradientText>
              ) : (
                <Text
                  style={[styles.surahName, tableColumns && styles.tableName]}>
                  {titleText}
                </Text>
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
              <Text
                style={[
                  styles.surahSecondaryInfo,
                  tableColumns && styles.tableSecondary,
                ]}>
                {meaning ?? versesLabel}
              </Text>
            </View>
            {tableColumns ? null : rewayatName ? (
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
                  {t(
                    revelationPlace === 'makkah'
                      ? 'surahItem.makkah'
                      : 'surahItem.madinah',
                  )}
                </Text>
              </View>
            )}
          </View>
          {tableColumns && (
            <>
              <Text
                style={[styles.tableCell, styles.tableRevelation]}
                accessibilityElementsHidden={true}>
                {t(
                  revelationPlace === 'makkah'
                    ? 'surahItem.makkah'
                    : 'surahItem.madinah',
                )}
              </Text>
              <Text
                style={[styles.tableCell, styles.tableVerses]}
                accessibilityElementsHidden={true}>
                {localizeDigits(item.verses_count)}
              </Text>
            </>
          )}
        </Pressable>

        {/* Right zone - Options action */}
        {onOptionsPress && (
          <Pressable
            style={styles.optionsZone}
            onPress={handleOptionsPress}
            accessibilityRole="button"
            accessibilityLabel={t('surahItem.moreOptions')}
            accessibilityHint={t('surahItem.moreOptionsHint')}>
            {isCurrentTrack ? (
              <NowPlayingIndicator
                isPlaying={
                  playbackStatus === 'playing' || playbackStatus === 'buffering'
                }
                barCount={3}
                surahId={Number(item.id)}
              />
            ) : (
              <Feather
                name="more-horizontal"
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
// @ai-end

SurahItem.displayName = 'SurahItem';

// @ai-start
/**
 * Column labels for SurahItem rows in `tableColumns` mode. It reuses the
 * row's styles so the columns line up. `withOptions` reserves the options
 * column when the rows have one.
 */
export function SurahTableHeader({
  withOptions = true,
}: {
  withOptions?: boolean;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const styles = createStyles(theme);
  return (
    <View
      style={styles.surahItem}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants">
      <View style={[styles.playZone, styles.tableHeaderZone]}>
        <View style={styles.tableHeaderLead} />
        <Text style={[styles.tableHeaderText, styles.tableHeaderTitle]}>
          {t('surahItem.columnSurah')}
        </Text>
        <Text style={[styles.tableHeaderText, styles.tableRevelation]}>
          {t('surahItem.columnRevelation')}
        </Text>
        <Text style={[styles.tableHeaderText, styles.tableVerses]}>
          {t('surahItem.columnVerses')}
        </Text>
      </View>
      {withOptions && <View style={styles.optionsZone} />}
    </View>
  );
}
// @ai-end

// @ai-start
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
      paddingStart: moderateScale(12),
    },
    optionsZone: {
      width: '20%',
      minWidth: moderateScale(50),
      maxWidth: moderateScale(70),
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(8),
      paddingEnd: moderateScale(12),
      alignSelf: 'stretch',
    },
    surahGlyphContainer: {
      width: moderateScale(60),
      height: moderateScale(45),
      alignItems: 'center',
      justifyContent: 'center',
      marginEnd: moderateScale(4),
    },
    surahInfoContainer: {
      flex: 1,
      marginStart: moderateScale(4),
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
    // iPad table layout (tableColumns and SurahTableHeader), in points.
    tableName: {
      fontSize: 16,
    },
    tableSecondary: {
      fontSize: 13,
    },
    tableCell: {
      fontSize: 14,
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    tableRevelation: {
      width: 130,
    },
    tableVerses: {
      width: 80,
    },
    tableHeaderZone: {
      paddingVertical: moderateScale(6),
    },
    tableHeaderLead: {
      width: moderateScale(64),
    },
    tableHeaderTitle: {
      flex: 1,
      marginStart: moderateScale(4),
    },
    tableHeaderText: {
      fontSize: 12,
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: latinLetterSpacing(0.8),
    },
  });
// @ai-end
