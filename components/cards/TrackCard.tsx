import React, {useEffect, useState, useMemo} from 'react';
import {Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {ReciterImage} from '@/components/ReciterImage';
import {getSurahById, getReciterById} from '@/services/dataService';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Reciter, Rewayat} from '@/data/reciterData';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {State as TrackPlayerState} from 'react-native-track-player';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';

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

  // Check if this item is the currently active track
  const isCurrentlyPlaying = useMemo(() => {
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
      borderRadius: moderateScale(15),
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
    reciterName: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginBottom: verticalScale(1),
      marginLeft: moderateScale(4),
    },
    rewayatText: {
      fontSize: moderateScale(9),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginLeft: moderateScale(4),
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
        {isCurrentlyPlaying && (
          <View style={styles.nowPlayingOverlay}>
            <NowPlayingIndicator
              isPlaying={
                playbackStatus === TrackPlayerState.Playing ||
                playbackStatus === TrackPlayerState.Buffering
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
        <Text style={styles.surahName} numberOfLines={1}>
          {surah.id}. {surah.name}
        </Text>
        <Text style={styles.surahGlyph}>{surahGlyph}</Text>
      </View>
      <Text style={styles.reciterName} numberOfLines={1}>
        {reciter.name}
      </Text>
      {rewayat && (
        <Text style={styles.rewayatText} numberOfLines={1}>
          {rewayat.name}
          {rewayat.style ? ` • ${rewayat.style}` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
};
