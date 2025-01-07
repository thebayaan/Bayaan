import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {PlayIcon} from '@/components/Icons';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {usePlayerStore} from '@/store/playerStore';
import {useProgress} from 'react-native-track-player';

interface RecentReciterCardProps {
  imageUrl: string;
  reciterName: string;
  surahName: string;
  trackId: string;
  onPress: () => void;
  progress?: number;
}

export const RecentReciterCard: React.FC<RecentReciterCardProps> = ({
  imageUrl,
  reciterName,
  surahName,
  trackId,
  onPress,
  progress = 0,
}) => {
  const {theme} = useTheme();
  const {activeTrackId} = usePlayerStore();
  const isPlaying = activeTrackId === trackId;

  // Use TrackPlayer progress for live updates
  const {position = 0, duration = 0} = useProgress(100);

  // Calculate progress percentage
  const progressPercentage =
    isPlaying && activeTrackId === trackId
      ? duration > 0
        ? (position / duration) * 100
        : 0
      : progress * 100;

  // Calculate time remaining
  const timeRemaining =
    isPlaying && activeTrackId === trackId
      ? duration > 0
        ? duration - position
        : 0
      : 0;

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds >= 3600) {
      return `${Math.round(seconds / 3600)}h`;
    }
    return `${Math.round(seconds / 60)}m`;
  };

  const styles = StyleSheet.create({
    container: {
      width: moderateScale(200),
      height: moderateScale(280),
      borderRadius: moderateScale(20),
      overflow: 'hidden',
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: Color(theme.colors.primary).alpha(0.03).toString(),
    },
    content: {
      flex: 1,
      padding: moderateScale(16),
    },
    imageContainer: {
      width: '100%',
      height: moderateScale(160),
      borderRadius: moderateScale(16),
      marginBottom: verticalScale(12),
      overflow: 'hidden',
      shadowColor: theme.colors.shadow,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius: moderateScale(16),
    },
    textContainer: {
      flex: 1,
    },
    reciterName: {
      fontSize: moderateScale(18),
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: verticalScale(4),
    },
    surahName: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
    progressSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: moderateScale(8),
      backgroundColor: Color(theme.colors.primary).alpha(0.1).toString(),
      borderRadius: moderateScale(20),
      paddingVertical: moderateScale(4),
      paddingHorizontal: moderateScale(8),
      gap: moderateScale(8),
      width: moderateScale(100),
      alignSelf: 'flex-start',
    },
    progressContainer: {
      width: moderateScale(25),
      height: moderateScale(6),
      backgroundColor: Color(theme.colors.primary).alpha(0.2).toString(),
      borderRadius: moderateScale(3),
    },
    progressBar: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: moderateScale(3),
    },
    timeRemaining: {
      fontSize: moderateScale(12),
      color: theme.colors.text,
      minWidth: moderateScale(30),
      fontWeight: 'bold',
    },
    playButton: {},
  });

  return (
    <TouchableOpacity
      activeOpacity={0.99}
      style={styles.container}
      onPress={onPress}>
      <LinearGradient
        colors={[
          Color(theme.colors.primary).alpha(0.03).toString(),
          Color(theme.colors.primary).alpha(0.01).toString(),
        ]}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <ReciterImage
            imageUrl={imageUrl}
            reciterName={reciterName}
            style={styles.image}
          />
          {progress > 0 && (
            <View style={styles.progressContainer}>
              <View
                style={[styles.progressBar, {width: `${progressPercentage}%`}]}
              />
            </View>
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.reciterName} numberOfLines={1}>
            {reciterName}
          </Text>
          <Text style={styles.surahName} numberOfLines={1}>
            {surahName}
          </Text>
          <View style={styles.progressSection}>
            <TouchableOpacity
              activeOpacity={0.99}
              style={styles.playButton}
              onPress={onPress}>
              <PlayIcon
                color={theme.colors.text}
                size={moderateScale(20)}
                filled={isPlaying}
              />
            </TouchableOpacity>
            <View style={styles.progressContainer}>
              <View
                style={[styles.progressBar, {width: `${progressPercentage}%`}]}
              />
            </View>
            <Text style={styles.timeRemaining}>
              {formatTimeRemaining(timeRemaining)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};
