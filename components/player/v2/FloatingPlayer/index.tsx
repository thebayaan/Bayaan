import React, {useCallback, useMemo, useRef} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {usePathname} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {expandPlayerSheet} from '@/services/player/sheetRef';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {ReciterImage} from '@/components/ReciterImage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import {
  getFloatingPlayerBottomPosition,
  FLOATING_UI_HORIZONTAL_MARGIN,
} from '@/utils/constants';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {useResponsive} from '@/hooks/useResponsive';

export const FloatingPlayer: React.FC = React.memo(function FloatingPlayer() {
  const {theme} = useTheme();
  const glassColorScheme = useGlassColorScheme();
  const {play, pause} = usePlayerActions();
  const playbackState = usePlayerStore(state => state.playback.state);
  const queueTracks = usePlayerStore(state => state.queue.tracks);
  const currentIndex = usePlayerStore(state => state.queue.currentIndex);
  const trackLoading = usePlayerStore(state => state.loading.trackLoading);
  const stateRestoring = usePlayerStore(state => state.loading.stateRestoring);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isMushafActive = pathname === '/mushaf';
  const {isTablet} = useResponsive();
  const prevTrackIdRef = useRef<string | null>(null);

  const currentTrack = useMemo(
    () => queueTracks?.[currentIndex],
    [queueTracks, currentIndex],
  );

  const isLoadingNewTrack = useMemo(() => {
    const isTrackChanging = currentTrack?.id !== prevTrackIdRef.current;
    if (currentTrack?.id) {
      prevTrackIdRef.current = currentTrack.id;
    }
    return (trackLoading && isTrackChanging) || playbackState === 'buffering';
  }, [trackLoading, playbackState, currentTrack?.id]);

  // iPad uses TabletDockedPlayer inside the sidebar instead of this pill.
  const shouldShow =
    !stateRestoring && !!currentTrack && !isMushafActive && !isTablet;

  const handlePress = useCallback(() => {
    expandPlayerSheet();
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (playbackState === 'playing') {
      await pause();
    } else {
      await play();
    }
  }, [playbackState, pause, play]);

  const containerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      bottom: getFloatingPlayerBottomPosition(insets.bottom),
      left: FLOATING_UI_HORIZONTAL_MARGIN,
      right: FLOATING_UI_HORIZONTAL_MARGIN,
      borderRadius: moderateScale(100),
      overflow: 'hidden' as const,
      borderWidth: USE_GLASS ? 0 : 1,
      borderColor: USE_GLASS
        ? undefined
        : Color(theme.colors.text).alpha(0.1).toString(),
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 8,
    }),
    [theme.colors.text, insets.bottom],
  );

  if (!shouldShow) return null;

  const textColor = Color(theme.colors.text).alpha(0.85).toString();
  const subtitleColor = Color(theme.colors.textSecondary)
    .alpha(0.45)
    .toString();

  const Container = USE_GLASS ? GlassView : FrostedView;

  return (
    <Container
      style={containerStyle}
      {...(USE_GLASS
        ? {glassEffectStyle: 'regular' as const, colorScheme: glassColorScheme}
        : {})}>
      <Pressable
        onPress={handlePress}
        style={styles.content}
        android_ripple={{color: 'rgba(0, 0, 0, 0.1)', borderless: false}}>
        <ReciterImage
          reciterName={currentTrack.reciterName}
          style={styles.artwork}
        />
        <View style={styles.trackInfo}>
          <Text style={[styles.title, {color: textColor}]} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text
            style={[styles.subtitle, {color: subtitleColor}]}
            numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>
        <Pressable
          onPress={handlePlayPause}
          style={styles.playButton}
          hitSlop={10}>
          {isLoadingNewTrack ? (
            <LoadingIndicator color={theme.colors.text} />
          ) : playbackState === 'playing' ? (
            <PauseIcon color={theme.colors.text} size={moderateScale(20, 0.2)} />
          ) : (
            <PlayIcon color={theme.colors.text} size={moderateScale(20, 0.2)} />
          )}
        </Pressable>
      </Pressable>
    </Container>
  );
});

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(14, 0.2),
    paddingVertical: moderateScale(7, 0.2),
    gap: moderateScale(10, 0.2),
  },
  artwork: {
    width: moderateScale(36, 0.2),
    height: moderateScale(36, 0.2),
    borderRadius: moderateScale(8, 0.2),
    overflow: 'hidden',
    flexShrink: 0,
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    fontSize: moderateScale(13, 0.2),
    fontFamily: 'Manrope-SemiBold',
  },
  subtitle: {
    fontSize: moderateScale(11, 0.2),
    fontFamily: 'Manrope-Medium',
  },
  playButton: {
    width: moderateScale(34, 0.2),
    height: moderateScale(34, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
