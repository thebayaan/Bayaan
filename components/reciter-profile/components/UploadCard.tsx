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

interface UploadCardProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  onLongPress?: () => void;
  color: string;
  style?: StyleProp<ViewStyle>;
  uploadId?: string;
  surahNumber?: number;
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
          height: moderateScale(120),
          borderRadius: moderateScale(12),
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: Color(theme.colors.border).alpha(0.15).toString(),
        },
        content: {
          flex: 1,
          padding: moderateScale(8),
          justifyContent: 'center',
          alignItems: 'center',
        },
        iconContainer: {
          marginBottom: moderateScale(8),
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
        {isCurrentTrack && surahNumber ? (
          <GradientText style={styles.title} surahId={surahNumber}>
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
      </View>
      {isCurrentTrack && (
        <View style={styles.nowPlayingCorner}>
          <NowPlayingIndicator
            isPlaying={isPlaying}
            barCount={3}
            surahId={surahNumber}
          />
        </View>
      )}
    </Pressable>
  );
};
