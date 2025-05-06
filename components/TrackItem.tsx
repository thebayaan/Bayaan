import React, {useEffect, useState, useMemo} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/themed';
import {ReciterImage} from '@/components/ReciterImage';
import {getSurahById, getReciterById} from '@/services/dataService';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Reciter, Rewayat} from '@/data/reciterData';
import Color from 'color';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {State as TrackPlayerState} from 'react-native-track-player';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';

interface TrackItemProps {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
  onPress: () => void;
  onPlayPress?: () => void;
}

export const TrackItem: React.FC<TrackItemProps> = React.memo(
  ({reciterId, surahId, rewayatId, onPress, onPlayPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
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
          {rewayat.style ? ` • ${rewayat.style}` : ''}
        </Text>
      );
    };

    const handlePlayButtonPress = (e: any) => {
      e.stopPropagation(); // Prevent triggering onPress of the main item
      onPlayPress?.();
    };

    return (
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.trackItem}
        onPress={onPress}>
        <View style={styles.imageContainer}>
          <ReciterImage
            reciterName={reciter?.name || ''}
            imageUrl={reciter?.image_url || undefined}
            style={styles.reciterImage}
          />
        </View>

        <View style={styles.trackInfo}>
          <View style={styles.surahNameContainer}>
            <View style={styles.surahTextContainer}>
              <View style={styles.surahNameRow}>
                {(onPlayPress || isCurrentlyPlaying) && (
                  <TouchableOpacity
                    style={styles.playIndicatorContainer}
                    onPress={handlePlayButtonPress}
                    activeOpacity={0.7}>
                    {isCurrentlyPlaying ? (
                      <NowPlayingIndicator
                        isPlaying={
                          playbackStatus === TrackPlayerState.Playing ||
                          playbackStatus === TrackPlayerState.Buffering
                        }
                        surahId={surah.id}
                        barCount={3}
                        barWidth={moderateScale(2.5)}
                        gap={moderateScale(1.5)}
                      />
                    ) : (
                      <Icon
                        name="play-circle"
                        type="feather"
                        size={moderateScale(18)}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                )}
                <Text style={styles.surahName}>
                  {surah.id + '. ' + surah.name}
                </Text>
              </View>
              <Text style={styles.reciterName}>{reciter.name}</Text>
              {renderRewayatBadge()}
            </View>

            <Text style={styles.surahGlyph}>{surahGlyph}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

TrackItem.displayName = 'TrackItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    trackItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(10),
      marginHorizontal: moderateScale(15),
      borderRadius: moderateScale(8),
      marginVertical: moderateScale(4),
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
    surahNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    surahTextContainer: {
      flexShrink: 1,
      marginRight: moderateScale(8),
    },
    surahNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: moderateScale(1),
    },
    surahName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    surahGlyph: {
      fontSize: moderateScale(24),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
      textAlign: 'right',
    },
    reciterName: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginVertical: moderateScale(2),
    },
    rewayatBadge: {
      marginTop: moderateScale(4),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(2),
      borderRadius: moderateScale(4),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      alignSelf: 'flex-start',
    },
    rewayatText: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    playIndicatorContainer: {
      marginRight: moderateScale(6),
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
