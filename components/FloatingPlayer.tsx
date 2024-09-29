import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import TrackPlayer, {
  usePlaybackState,
  State,
  Track,
} from 'react-native-track-player';
import {useSharedValue, withTiming, Easing} from 'react-native-reanimated';
import {surahGlyphMap} from '@/utils/surahGlyphMap';

export const FloatingPlayer: React.FC = () => {
  const router = useRouter();
  const {theme} = useTheme();
  const playbackState = usePlaybackState();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const styles = createStyles(theme);

  const translateY = useSharedValue(100);

  useEffect(() => {
    const fetchCurrentTrack = async () => {
      const track = await TrackPlayer.getCurrentTrack();
      if (track !== null) {
        const trackObject = await TrackPlayer.getTrack(track);
        setCurrentTrack(trackObject || null);
        translateY.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        translateY.value = withTiming(100, {
          duration: 300,
          easing: Easing.in(Easing.cubic),
        });
      }
    };

    fetchCurrentTrack();
  }, [playbackState, translateY]);

  if (!currentTrack) return null;

  const handlePress = () => {
    router.push('/player');
  };

  const togglePlayback = async () => {
    const currentState = await TrackPlayer.getState();
    if (currentState === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const surahNumber = currentTrack.id
    ? parseInt(currentTrack.id, 10)
    : undefined;
  const surahGlyph = surahNumber ? surahGlyphMap[surahNumber] : '';

  return (
    <View style={[styles.container]}>
      <TouchableOpacity style={styles.content} onPress={handlePress}>
        <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
          <Icon
            name={playbackState.state === State.Playing ? 'pause' : 'play'}
            type="foundation"
            color={theme.colors.text}
            size={moderateScale(30)}
          />
        </TouchableOpacity>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>
        <Text style={styles.surahName}>{surahGlyph}</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      position: 'absolute',
      bottom: 100,
      left: moderateScale(10),
      right: moderateScale(10),
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: moderateScale(15),
      paddingHorizontal: moderateScale(15),
      paddingVertical: moderateScale(6),
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    artist: {
      fontSize: moderateScale(14),
      color: theme.colors.text,
    },
    playButton: {
      paddingRight: moderateScale(10),
    },
    surahName: {
      fontFamily: 'SurahNames',
      fontSize: moderateScale(26),
      color: theme.colors.text,
      alignSelf: 'center',
    },
  });
