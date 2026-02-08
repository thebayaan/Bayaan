import React, {useEffect, useState, useMemo} from 'react';
import {View, Text, Pressable, GestureResponderEvent} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {ReciterImage} from '@/components/ReciterImage';
import {getSurahById, getReciterById} from '@/services/dataService';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Reciter, Rewayat} from '@/data/reciterData';
import Color from 'color';
import {usePlayerStore} from '@/services/player/store/playerStore';

import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {
  useDownloadProgress,
  useIsDownloaded,
  useIsDownloadedWithRewayat,
  useIsDownloading,
} from '@/services/player/store/downloadSelectors';
import {CircularProgress} from '@/components/CircularProgress';
import {Ionicons} from '@expo/vector-icons';
import {GradientText} from '@/components/GradientText';
import {Icon} from '@rneui/themed';

interface TrackItemProps {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
  onPress: () => void;
  onPlayPress?: () => void;
  hidePlayButton?: boolean;
  onOptionsPress?: () => void;
}

export const TrackItem: React.FC<TrackItemProps> = React.memo(
  ({
    reciterId,
    surahId,
    rewayatId,
    onPress,
    onPlayPress,
    hidePlayButton,
    onOptionsPress,
  }) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const [reciter, setReciter] = useState<Reciter | null>(null);
    const [rewayat, setRewayat] = useState<Rewayat | null>(null);

    // Get player state
    const playbackStatus = usePlayerStore(state => state.playback.state);
    const currentIndex = usePlayerStore(state => state.queue.currentIndex);
    const tracks = usePlayerStore(state => state.queue.tracks);

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
      const currentTrack =
        tracks && currentIndex >= 0 && currentIndex < tracks.length
          ? tracks[currentIndex]
          : null;

      if (!reciterId || !currentTrack || !surahId) return false;

      const rewayatMatches =
        rewayatId && currentTrack.rewayatId
          ? rewayatId === currentTrack.rewayatId
          : !rewayatId && !currentTrack.rewayatId; // Match if both are undefined/null

      return (
        currentTrack.reciterId === reciterId &&
        currentTrack.surahId === surahId && // surahId is already string here
        rewayatMatches
      );
    }, [reciterId, surahId, rewayatId, currentIndex, tracks]);

    useEffect(() => {
      let mounted = true;
      const loadReciter = async () => {
        try {
          const data = await getReciterById(reciterId);
          if (mounted && data) {
            setReciter(data);
            // Find the rewayat if rewayatId is provided
            if (rewayatId && data.rewayat) {
              const foundRewayat = data.rewayat.find(r => r.id === rewayatId);
              if (foundRewayat) {
                setRewayat(foundRewayat);
              }
            }
          }
        } catch (error) {
          console.error('Error loading reciter:', error);
        }
      };
      loadReciter();
      return () => {
        mounted = false;
      };
    }, [reciterId, rewayatId]);

    const surah = getSurahById(parseInt(surahId, 10));
    if (!surah || !reciter) return null;

    const surahGlyph = surahGlyphMap[surah.id];

    // Create a compact badge for the rewayat if available
    const renderRewayatBadge = () => {
      if (!rewayat) return null;
      return (
        <Text style={styles.rewayatText}>
          {rewayat.name}
          {rewayat.style ? ` \u2022 ${rewayat.style}` : ''}
        </Text>
      );
    };

    return (
      <View style={styles.trackItem}>
        {/* Play zone */}
        <Pressable style={styles.playZone} onPress={onPress}>
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
                <GradientText style={styles.surahName} surahId={surah.id}>
                  {surah.id + '. ' + surah.name}
                </GradientText>
              ) : (
                <Text style={styles.surahName}>
                  {surah.id + '. ' + surah.name}
                </Text>
              )}
              {surahGlyph && (
                <Text style={styles.surahGlyphInline}>{surahGlyph}</Text>
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
              <Text style={styles.reciterName}>{reciter.name}</Text>
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

TrackItem.displayName = 'TrackItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    trackItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
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
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    surahGlyphInline: {
      fontSize: moderateScale(16),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
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
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    downloadIcon: {
      marginTop: moderateScale(1),
    },
    rewayatText: {
      fontSize: moderateScale(10),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
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
