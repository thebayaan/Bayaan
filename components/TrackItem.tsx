import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {useResponsive} from '@/hooks/useResponsive'; // @ai
import {ReciterImage} from '@/components/ReciterImage';
import {getSurahById, getReciterByIdSync} from '@/services/dataService';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {usePlayerStore} from '@/services/player/store/playerStore';

import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {
  useDownloadProgress,
  useIsDownloadedForPlayback,
  useIsDownloading,
} from '@/services/player/store/downloadSelectors';
import {CircularProgress} from '@/components/CircularProgress';
import {Feather, Ionicons} from '@expo/vector-icons';
import {GradientText} from '@/components/GradientText';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
// @ai-start
import {useTranslation} from 'react-i18next';
import {currentLanguageConfig} from '@/i18n/language'; // @ai
// @ai-start
import {useSurahOptionsContext} from '@/components/sheets/options/SurahOptionsContext';
import {useNativeOptionsMenu} from '@/components/sheets/options/OptionsMenu';
import {listRowContextMenusEnabled} from '@/components/native/nativeMenus'; // @ai
import {
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PANEL_ART_SIZE,
  PANEL_ART_RADIUS,
} from '@/components/collection/CollectionPanel'; // @ai
// @ai-end
import {
  getReciterDisplayName,
  getSurahDisplayName,
  localizeDigits,
} from '@/i18n/format';
// @ai-end

// @ai-start
const KNOWN_STYLES = ['murattal', 'mojawwad', 'molim'] as const;
// @ai-end

interface TrackItemProps {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
  userRecitationId?: string;
  onPress: () => void;
  onPlayPress?: () => void;
  hidePlayButton?: boolean;
  onOptionsPress?: () => void;
  onLongPress?: () => void;
  /**
   * A native menu laid over the ••• button on tablets, for screens whose
   * options aren't surah options (downloads, uploads). @ai
   */
  optionsMenu?: React.ReactNode;
  /** Drawn in place of the reciter photo, e.g. a surah cover. @ai */
  art?: React.ReactNode;
  /** No row background, for rows inside a panel. @ai */
  transparent?: boolean;
  /** Leave out the reciter's name, e.g. under that reciter's heading. @ai */
  hideReciterName?: boolean;
  /** Prefix the title with the surah number (default true). @ai */
  showSurahNumber?: boolean;
}

// @ai-start
export const TrackItem: React.FC<TrackItemProps> = React.memo(
  ({
    reciterId,
    surahId,
    rewayatId,
    userRecitationId,
    onPress,
    onPlayPress,
    hidePlayButton,
    onOptionsPress,
    onLongPress,
    optionsMenu,
    art, // @ai
    showSurahNumber = true, // @ai
    transparent, // @ai
    hideReciterName, // @ai
  }) => {
    const {theme} = useTheme();
    // @ai-start
    // On iPad (not in a compact window) inset the row by the page margin
    // (ipad-standards §5.2) so it never touches the pane edge when the
    // capped column is as wide as the pane (11" portrait).
    const {isTablet, width: windowWidth} = useResponsive();
    const tabletInset =
      isTablet && windowWidth >= 600
        ? {
            marginHorizontal: windowWidth >= 900 ? 32 : 24,
            borderRadius: 12,
            overflow: 'hidden' as const,
          }
        : null;
    // @ai-end
    const {t} = useTranslation(['collection', 'common']);
    const {t: tHome} = useTranslation('home'); // @ai

    // Sync data loading — no async, no useState, no useEffect
    const reciter = useMemo(
      () => getReciterByIdSync(reciterId) ?? null,
      [reciterId],
    );

    const rewayat = useMemo(
      () =>
        rewayatId
          ? (reciter?.rewayat?.find(r => r.id === rewayatId) ?? null)
          : null,
      [reciter, rewayatId],
    );

    // Get player state — subscribe to currentTrack instead of full tracks array
    const playbackStatus = usePlayerStore(state => state.playback.state);
    const currentTrack = usePlayerStore(
      state => state.queue.tracks[state.queue.currentIndex] ?? null,
    );

    const downloadId = useMemo(
      () =>
        rewayatId
          ? `${reciterId}-${surahId}-${rewayatId}`
          : `${reciterId}-${surahId}`,
      [reciterId, surahId, rewayatId],
    );

    // Downloaded when playing the row uses a downloaded file. A row in the
    // reciter's first rewayah also plays one an older version recorded
    // without a rewayah (Loved surahs saved without one).
    const isDownloadedState = useIsDownloadedForPlayback(
      reciterId,
      surahId,
      rewayatId,
    );

    // Check if currently downloading - use isDownloadingWithRewayat if rewayatId is provided
    const isCurrentlyDownloading = useIsDownloading(downloadId);

    // Get download progress
    const downloadProgress = useDownloadProgress(downloadId);

    // Check if this is the current track (regardless of play state)
    const isCurrentTrack = useMemo(() => {
      if (!currentTrack) return false;

      // For upload tracks, match by userRecitationId. An upload's row is
      // that upload only, never the reciter's own recording of the surah.
      if (userRecitationId) {
        return userRecitationId === currentTrack.userRecitationId;
      }

      if (!reciterId || !surahId) return false;

      // A row saved without a rewayah (older Loved and Downloads entries)
      // plays the reciter's first one, so that is the one to compare. The
      // playing track always names its rewayah, so such a row was never
      // shown as playing.
      const rowRewayatId = rewayatId || reciter?.rewayat?.[0]?.id;
      const rewayatMatches =
        rowRewayatId && currentTrack.rewayatId
          ? rowRewayatId === currentTrack.rewayatId
          : !rewayatId && !currentTrack.rewayatId;

      return (
        currentTrack.reciterId === reciterId &&
        currentTrack.surahId === surahId &&
        rewayatMatches
      );
    }, [
      reciterId,
      surahId,
      rewayatId,
      userRecitationId,
      currentTrack,
      reciter,
    ]);

    // @ai-start
    const options = useSurahOptionsContext();
    const tapMenuAvailable = useNativeOptionsMenu('tap');
    const rowMenuAvailable =
      useNativeOptionsMenu('longPress') && listRowContextMenusEnabled;
    // @ai-end

    const surah = getSurahById(parseInt(surahId, 10));
    if (!surah || !reciter) return null;

    // @ai-start
    // Screens that provide surah options get native menus on tablets: ••• on
    // a tap, and the row on a long press or secondary click (iPad).
    const optionsPayload =
      onOptionsPress && options
        ? options.build(surah, {reciterId, rewayatId, userRecitationId})
        : null;
    const tapMenu = tapMenuAvailable && !!optionsPayload;
    const rowMenu = rowMenuAvailable && !!optionsPayload;
    // @ai-end

    // The Arabic surah name is already shown as text in Arabic mode.
    const surahGlyph =
      currentLanguageConfig.bilingualContent === 'ar' || art // @ai
        ? undefined
        : surahGlyphMap[surah.id];
    const surahTitle = showSurahNumber // @ai
      ? `${localizeDigits(surah.id)}. ${getSurahDisplayName(surah)}`
      : getSurahDisplayName(surah);
    const knownStyle = KNOWN_STYLES.find(
      s => s === rewayat?.style?.toLowerCase(),
    );
    const styleLabel = knownStyle
      ? t(`common:styles.${knownStyle}`)
      : rewayat?.style;

    // Create a compact badge for the rewayat if available
    const renderRewayatBadge = () => {
      if (!rewayat) return null;
      return (
        <Text style={[styles.rewayatText, {color: theme.colors.textSecondary}]}>
          {getDisplayLabelFromName(rewayat.name)}
          {styleLabel ? ` \u2022 ${styleLabel}` : ''}
        </Text>
      );
    };

    const playZone = (
      <Pressable
        style={[styles.playZone, transparent && panelPlayZone]} // @ai
        onPress={onPress}
        onLongPress={rowMenu ? undefined : onLongPress}>
        <View style={styles.imageContainer}>
          {art ?? ( // @ai
            <ReciterImage
              reciterName={reciter?.name || ''}
              imageUrl={reciter?.image_url || undefined}
              style={[styles.reciterImage, transparent && panelArt]} // @ai
            />
          )}
        </View>

        <View style={styles.trackInfo}>
          <View style={styles.surahNameRow}>
            {isCurrentTrack ? (
              <GradientText
                style={[styles.surahName, {color: theme.colors.text}]}
                surahId={surah.id}>
                {surahTitle}
              </GradientText>
            ) : (
              <Text style={[styles.surahName, {color: theme.colors.text}]}>
                {surahTitle}
              </Text>
            )}
            {surahGlyph && (
              <Text
                style={[styles.surahGlyphInline, {color: theme.colors.text}]}>
                {surahGlyph}
              </Text>
            )}
          </View>
          {/* Under its reciter's heading the whole line would repeat. @ai */}
          {transparent ? (
            // @ai In a panel: one secondary line, like Music's two-line
            // rows: reciter · riwayah (or just the riwayah under a heading),
            // still led by the download state.
            <View style={styles.reciterInfoRow}>
              {isCurrentlyDownloading ? (
                <CircularProgress
                  progress={downloadProgress}
                  size={moderateScale(13)}
                  strokeWidth={moderateScale(1.5)}
                  color={theme.colors.textSecondary}
                />
              ) : isDownloadedState && !hideReciterName ? (
                <Ionicons
                  name="arrow-down-circle"
                  size={moderateScale(13)}
                  color={theme.colors.textSecondary}
                  style={styles.downloadIcon}
                />
              ) : null}
              <Text
                style={[
                  styles.reciterName,
                  {color: theme.colors.textSecondary, flexShrink: 1},
                ]}
                numberOfLines={1}>
                {[
                  hideReciterName ? null : getReciterDisplayName(reciter),
                  rewayat
                    ? `${getDisplayLabelFromName(rewayat.name)}${
                        styleLabel ? ` \u2022 ${styleLabel}` : ''
                      }`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' \u00B7 ')}
              </Text>
            </View>
          ) : hideReciterName ? null : (
            <View style={styles.reciterInfoRow}>
              {isCurrentlyDownloading ? (
                <CircularProgress
                  progress={downloadProgress}
                  size={moderateScale(13)}
                  strokeWidth={moderateScale(1.5)}
                  color={theme.colors.textSecondary}
                />
              ) : isDownloadedState ? (
                <Ionicons
                  name="arrow-down-circle"
                  size={moderateScale(13)}
                  color={theme.colors.textSecondary}
                  style={styles.downloadIcon}
                />
              ) : null}
              <Text
                style={[
                  styles.reciterName,
                  {color: theme.colors.textSecondary},
                ]}>
                {getReciterDisplayName(reciter)}
              </Text>
            </View>
          )}
          {transparent ? null : renderRewayatBadge()}
        </View>
      </Pressable>
    );

    return (
      <View
        style={[
          styles.trackItem,
          {backgroundColor: transparent ? 'transparent' : theme.colors.card}, // @ai
          tabletInset, // @ai
        ]}>
        {/* Play zone */}
        {/* @ai-start */}
        {rowMenu && options ? (
          <options.Menu
            payload={optionsPayload}
            trigger="longPress"
            style={styles.playZoneHost}>
            {playZone}
          </options.Menu>
        ) : (
          playZone
        )}
        {/* @ai-end */}

        {/* Options zone */}
        {onOptionsPress && (
          <Pressable
            style={styles.optionsZone}
            accessibilityRole="button" // @ai
            accessibilityLabel={tHome('surahItem.moreOptions')} // @ai
            onPress={tapMenu || optionsMenu ? undefined : onOptionsPress}>
            {isCurrentTrack ? (
              <NowPlayingIndicator
                isPlaying={
                  playbackStatus === 'playing' || playbackStatus === 'buffering'
                }
                surahId={surah.id}
                barCount={3}
                barWidth={moderateScale(2)}
                gap={moderateScale(1.2)}
              />
            ) : (
              <Feather
                name="more-horizontal"
                size={moderateScale(18)}
                color={theme.colors.text}
              />
            )}
            {/* @ai-start */}
            {tapMenu && options ? (
              <options.Menu
                payload={optionsPayload}
                layout="overlay"
                accessibilityLabel={tHome('surahItem.moreOptions')}>
                <View />
              </options.Menu>
            ) : (
              optionsMenu
            )}
            {/* @ai-end */}
          </Pressable>
        )}
      </View>
    );
  },
);
// @ai-end

TrackItem.displayName = 'TrackItem';

// @ai-start
// Inside a Collection panel: the iOS list row padding.
const panelArt = {
  width: PANEL_ART_SIZE,
  height: PANEL_ART_SIZE,
  borderRadius: PANEL_ART_RADIUS,
};
const panelPlayZone = {
  paddingVertical: PANEL_ROW_VERTICAL,
  paddingStart: PANEL_ROW_PADDING,
  paddingEnd: 0,
};
const styles = StyleSheet.create({
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(18),
  },
  imageContainer: {
    marginEnd: moderateScale(12),
  },
  reciterImage: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(10),
  },
  trackInfo: {
    flex: 1,
  },
  surahNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(1),
  },
  surahName: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
  },
  surahGlyphInline: {
    fontSize: moderateScale(16),
    fontFamily: 'SurahNames',
    marginStart: moderateScale(6),
  },
  reciterInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    marginBottom: moderateScale(3),
  },
  reciterName: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Regular',
  },
  downloadIcon: {
    marginTop: moderateScale(1),
  },
  rewayatText: {
    fontSize: moderateScale(10),
    fontFamily: 'Manrope-Regular',
    textTransform: 'capitalize',
  },
  playZoneHost: {
    flex: 1,
  },
  optionsZone: {
    width: '20%' as any,
    minWidth: moderateScale(50),
    maxWidth: moderateScale(70),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(8),
    paddingEnd: moderateScale(12),
    alignSelf: 'stretch' as const,
  },
});
// @ai-end
