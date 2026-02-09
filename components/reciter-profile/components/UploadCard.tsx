import React, {useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {GradientText} from '@/components/GradientText';
import {surahGlyphMap} from '@/utils/surahGlyphMap';

import type {RecordingType} from '@/types/uploads';

interface UploadCardProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  onLongPress?: () => void;
  color: string;
  style?: StyleProp<ViewStyle>;
  uploadId?: string;
  surahNumber?: number;
  startVerse?: number | null;
  endVerse?: number | null;
  recordingType?: RecordingType;
}

export const UploadCard: React.FC<UploadCardProps> = ({
  title,
  subtitle,
  onPress,
  onLongPress,
  color,
  style,
  uploadId,
  surahNumber,
  startVerse,
  endVerse,
  recordingType,
}) => {
  const {theme} = useTheme();

  const playbackState = usePlayerStore(state => state.playback.state);
  const currentIndex = usePlayerStore(state => state.queue.currentIndex);
  const tracks = usePlayerStore(state => state.queue.tracks);

  const trackId = uploadId ? `upload-${uploadId}` : null;

  const isCurrentTrack = useMemo(() => {
    if (!trackId) return false;
    const current =
      tracks && currentIndex >= 0 && currentIndex < tracks.length
        ? tracks[currentIndex]
        : null;
    return current?.id === trackId;
  }, [tracks, currentIndex, trackId]);

  const isPlaying =
    isCurrentTrack &&
    (playbackState === 'playing' || playbackState === 'buffering');

  const gradientColors = useMemo((): [string, string] => {
    const base = Color(theme.colors.textSecondary);
    return [base.alpha(0.08).toString(), base.alpha(0.03).toString()];
  }, [theme.colors.textSecondary]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: moderateScale(120),
          minHeight: moderateScale(130),
          borderRadius: moderateScale(12),
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: Color(theme.colors.border).alpha(0.15).toString(),
        },
        content: {
          flex: 1,
          padding: moderateScale(10),
          justifyContent: 'center',
          alignItems: 'center',
          gap: moderateScale(4),
        },
        iconContainer: {
          marginBottom: moderateScale(4),
        },
        title: {
          fontSize: moderateScale(12),
          fontFamily: 'Manrope-Bold',
          color: theme.colors.text,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: moderateScale(9),
          fontFamily: 'Manrope-Medium',
          color: theme.colors.textSecondary,
          textAlign: 'center',
          marginTop: moderateScale(2),
        },
        nowPlayingCorner: {
          position: 'absolute',
          bottom: moderateScale(6),
          right: moderateScale(6),
        },
        surahGlyph: {
          fontSize: moderateScale(10),
          fontFamily: 'SurahNames',
          color: theme.colors.textSecondary,
          marginTop: moderateScale(2),
        },
        tagsRow: {
          flexDirection: 'row',
          gap: moderateScale(4),
          marginTop: moderateScale(4),
          flexWrap: 'wrap',
          justifyContent: 'center',
        },
        tag: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: moderateScale(5),
          paddingVertical: moderateScale(2),
          borderRadius: moderateScale(4),
          backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
        },
        tagText: {
          fontSize: moderateScale(8),
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.textSecondary,
        },
      }),
    [theme],
  );

  return (
    <Pressable
      style={[styles.container, style]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}>
      <LinearGradient
        colors={gradientColors}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Feather
            name="music"
            size={moderateScale(22)}
            color={theme.colors.textSecondary}
          />
        </View>
        {isCurrentTrack ? (
          <GradientText style={styles.title} surahId={surahNumber ?? 0}>
            {title}
          </GradientText>
        ) : (
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {title}
          </Text>
        )}
        {surahNumber && surahGlyphMap[surahNumber] ? (
          <Text style={styles.surahGlyph}>{surahGlyphMap[surahNumber]}</Text>
        ) : (
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        )}
        {(startVerse != null || recordingType != null) && (
          <View style={styles.tagsRow}>
            {startVerse != null && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>
                  {endVerse != null
                    ? `${startVerse}-${endVerse}`
                    : `v${startVerse}`}
                </Text>
              </View>
            )}
            {recordingType != null && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>
                  {recordingType === 'salah' ? 'Salah' : 'Studio'}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
      {isCurrentTrack && (
        <View style={styles.nowPlayingCorner}>
          <NowPlayingIndicator
            isPlaying={isPlaying}
            barCount={3}
            surahId={surahNumber ?? 0}
          />
        </View>
      )}
    </Pressable>
  );
};
