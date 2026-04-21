import React, {useEffect, useState, useMemo} from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ReciterImage} from '@/components/ReciterImage';
import {getSurahById, getReciterById} from '@/services/dataService';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Reciter, Rewayat} from '@/data/reciterData';
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

interface TrackCardProps {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
  onPress: () => void;
  width?: number;
  height?: number;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  reciterId,
  surahId,
  rewayatId,
  onPress,
  width,
  height,
}) => {
  const {theme} = useTheme();
  const [reciter, setReciter] = useState<Reciter | null>(null);
  const [rewayat, setRewayat] = useState<Rewayat | null>(null);

  // Get player state
  const playbackStatus = usePlayerStore(state => state.playback.state);
  const currentIndex = usePlayerStore(state => state.queue.currentIndex);
  const tracks = usePlayerStore(state => state.queue.tracks);

  const downloadId = React.useMemo(
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
  const isDownloadedState = rewayatId ? isDownloadedRewayat : isDownloadedBase;

  // Check if currently downloading - use isDownloadingWithRewayat if rewayatId is provided
  const isCurrentlyDownloading = useIsDownloading(downloadId);

  // Get download progress
  const downloadProgress = useDownloadProgress(downloadId);

  // Check if this item is the currently active track
  const isCurrentTrack = useMemo(() => {
    const currentTrack =
      tracks && currentIndex >= 0 && currentIndex < tracks.length
        ? tracks[currentIndex]
        : null;

    if (!reciterId || !currentTrack || !surahId) return false;

    const rewayatMatches =
      rewayatId && currentTrack.rewayatId
        ? rewayatId === currentTrack.rewayatId
        : !rewayatId && !currentTrack.rewayatId;

    return (
      currentTrack.reciterId === reciterId &&
      currentTrack.surahId === surahId &&
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

  // Use provided dimensions or fall back to default
  const cardWidth = width || moderateScale(120);
  const cardHeight = height || moderateScale(120);

  const styles = StyleSheet.create({
    container: {
      width: cardWidth,
    },
    imageContainer: {
      width: cardWidth,
      height: cardHeight,
      marginBottom: verticalScale(5),
      overflow: 'hidden',
      borderRadius: moderateScale(5),
      position: 'relative',
    },
    reciterImage: {
      width: '100%',
      height: '100%',
    },
    nowPlayingOverlay: {
      position: 'absolute',
      top: moderateScale(8),
      right: moderateScale(8),
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(4),
      borderRadius: moderateScale(8),
    },
    surahInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: verticalScale(2),
    },
    surahName: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      flex: 1,
      marginRight: moderateScale(4),
    },
    surahGlyph: {
      fontSize: moderateScale(16),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
    },
    reciterInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      marginBottom: verticalScale(1),
    },
    reciterName: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
    },
    downloadIcon: {
      marginTop: moderateScale(1),
    },
    rewayatText: {
      fontSize: moderateScale(9),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
  });

  return (
    <TouchableOpacity
      activeOpacity={0.99}
      style={styles.container}
      onPress={onPress}>
      <View style={styles.imageContainer}>
        <ReciterImage
          reciterName={reciter?.name || ''}
          imageUrl={reciter?.image_url || undefined}
          style={styles.reciterImage}
        />
        {isCurrentTrack && (
          <View style={styles.nowPlayingOverlay}>
            <NowPlayingIndicator
              isPlaying={
                playbackStatus === 'playing' || playbackStatus === 'buffering'
              }
              surahId={surah.id}
              barCount={3}
              barWidth={moderateScale(2)}
              gap={moderateScale(1.2)}
            />
          </View>
        )}
      </View>
      <View style={styles.surahInfo}>
        {isCurrentTrack ? (
          <GradientText style={styles.surahName} surahId={surah.id}>
            {surah.id + '. ' + surah.name}
          </GradientText>
        ) : (
          <Text style={styles.surahName} numberOfLines={1}>
            {surah.id}. {surah.name}
          </Text>
        )}
        <Text style={styles.surahGlyph}>{surahGlyph}</Text>
      </View>
      <View style={styles.reciterInfoRow}>
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
        <Text style={styles.reciterName} numberOfLines={1}>
          {reciter.name}
        </Text>
      </View>
      {rewayat && (
        <Text style={styles.rewayatText} numberOfLines={1}>
          {rewayat.name}
          {rewayat.style ? ` • ${rewayat.style}` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
};
