import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {getSurahById, getReciterByIdSync} from '@/services/dataService';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {usePlayerStore} from '@/services/player/store/playerStore';

import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {
  useDownloadProgress,
  useIsDownloaded,
  useIsDownloadedWithRewayat,
  useIsDownloading,
} from '@/services/player/store/downloadSelectors';
import {CircularProgress} from '@/components/CircularProgress';
import {Feather, Ionicons} from '@expo/vector-icons';
import {GradientText} from '@/components/GradientText';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';

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
}

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
  }) => {
    const {theme} = useTheme();

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

    // Calculate download state - use isDownloadedWithRewayat if rewayatId is provided
    const isDownloadedBase = useIsDownloaded(reciterId, surahId);
    const isDownloadedRewayat = useIsDownloadedWithRewayat(
      reciterId,
      surahId,
      rewayatId || '',
    );
    const isDownloadedState = rewayatId
      ? isDownloadedRewayat
      : isDownloadedBase;

    // Check if currently downloading - use isDownloadingWithRewayat if rewayatId is provided
    const isCurrentlyDownloading = useIsDownloading(downloadId);

    // Get download progress
    const downloadProgress = useDownloadProgress(downloadId);

    // Check if this is the current track (regardless of play state)
    const isCurrentTrack = useMemo(() => {
      if (!currentTrack) return false;

      // For upload tracks, match by userRecitationId
      if (userRecitationId && currentTrack.userRecitationId) {
        return userRecitationId === currentTrack.userRecitationId;
      }

      if (!reciterId || !surahId) return false;

      const rewayatMatches =
        rewayatId && currentTrack.rewayatId
          ? rewayatId === currentTrack.rewayatId
          : !rewayatId && !currentTrack.rewayatId;

      return (
        currentTrack.reciterId === reciterId &&
        currentTrack.surahId === surahId &&
        rewayatMatches
      );
    }, [reciterId, surahId, rewayatId, userRecitationId, currentTrack]);

    const surah = getSurahById(parseInt(surahId, 10));
    if (!surah || !reciter) return null;

    const surahGlyph = surahGlyphMap[surah.id];

    // Create a compact badge for the rewayat if available
    const renderRewayatBadge = () => {
      if (!rewayat) return null;
      return (
        <Text style={[styles.rewayatText, {color: theme.colors.textSecondary}]}>
          {getDisplayLabelFromName(rewayat.name)}
          {rewayat.style ? ` \u2022 ${rewayat.style}` : ''}
        </Text>
      );
    };

    return (
      <View style={[styles.trackItem, {backgroundColor: theme.colors.card}]}>
        {/* Play zone */}
        <Pressable
          style={styles.playZone}
          onPress={onPress}
          onLongPress={onLongPress}>
          <View style={styles.imageContainer}>
            <ReciterImage
              reciterName={reciter?.name || ''}
              imageUrl={reciter?.image_url || undefined}
              style={styles.reciterImage}
            />
          </View>

          <View style={styles.trackInfo}>
            <View style={styles.surahNameRow}>
              {isCurrentTrack ? (
                <GradientText
                  style={[styles.surahName, {color: theme.colors.text}]}
                  surahId={surah.id}>
                  {surah.id + '. ' + surah.name}
                </GradientText>
              ) : (
                <Text style={[styles.surahName, {color: theme.colors.text}]}>
                  {surah.id + '. ' + surah.name}
                </Text>
              )}
              {surahGlyph && (
                <Text
                  style={[styles.surahGlyphInline, {color: theme.colors.text}]}>
                  {surahGlyph}
                </Text>
              )}
            </View>
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
                {reciter.name}
              </Text>
            </View>
            {renderRewayatBadge()}
          </View>
        </Pressable>

        {/* Options zone */}
        {onOptionsPress && (
          <Pressable style={styles.optionsZone} onPress={onOptionsPress}>
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
          </Pressable>
        )}
      </View>
    );
  },
);

TrackItem.displayName = 'TrackItem';

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
    marginRight: moderateScale(12),
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
    marginLeft: moderateScale(6),
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
  optionsZone: {
    width: '20%' as any,
    minWidth: moderateScale(50),
    maxWidth: moderateScale(70),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(8),
    paddingRight: moderateScale(12),
    alignSelf: 'stretch' as const,
  },
});
