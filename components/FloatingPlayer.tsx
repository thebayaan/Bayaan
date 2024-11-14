import React, {useEffect} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import TrackPlayer, {usePlaybackState, State} from 'react-native-track-player';
import {useSharedValue, withTiming, Easing} from 'react-native-reanimated';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {usePlayerBackground} from '@/hooks/usePlayerBackground';
import {LinearGradient} from 'expo-linear-gradient';
import {StyleSheet} from 'react-native';
import {usePlayerStore} from '@/store/playerStore';

export const FloatingPlayer: React.FC = () => {
  const router = useRouter();
  const {theme, isDarkMode} = useTheme();
  const playbackState = usePlaybackState();
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const updateCurrentTrack = usePlayerStore(state => state.updateCurrentTrack);
  const styles = createStyles(theme);
  const {gradientColors} = usePlayerBackground(theme, isDarkMode);

  const translateY = useSharedValue(100);

  useEffect(() => {
    updateCurrentTrack();
  }, [playbackState, updateCurrentTrack]);

  useEffect(() => {
    translateY.value = withTiming(currentTrack ? 0 : 100, {
      duration: 300,
      easing: currentTrack ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [currentTrack, translateY]);

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
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <TouchableOpacity style={styles.content} onPress={handlePress}>
        <View style={styles.playButtonContainer}>
          <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
            {playbackState.state === State.Playing ? (
              <PauseIcon color={theme.colors.text} size={moderateScale(26)} />
            ) : (
              <PlayIcon color={theme.colors.text} size={moderateScale(30)} />
            )}
          </TouchableOpacity>
        </View>
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
      bottom: 105, // Add some padding
      left: moderateScale(10),
      right: moderateScale(10),
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
      overflow: 'hidden',
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
    playButtonContainer: {
      width: moderateScale(30),
      height: moderateScale(40),
      justifyContent: 'center',
      alignItems: 'center',
    },
    surahName: {
      fontFamily: 'SurahNames',
      fontSize: moderateScale(26),
      color: theme.colors.text,
      alignSelf: 'center',
    },
  });
