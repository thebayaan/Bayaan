import React, {useCallback, useMemo, useRef} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {ReciterImage} from '@/components/ReciterImage';
import Color from 'color';

function MiniPlayerInner() {
  const {theme} = useTheme();
  const {play, pause, setSheetMode} = usePlayerActions();
  const playbackState = usePlayerStore(state => state.playback.state);
  const queueTracks = usePlayerStore(state => state.queue.tracks);
  const currentIndex = usePlayerStore(state => state.queue.currentIndex);
  const trackLoading = usePlayerStore(state => state.loading.trackLoading);
  const stateRestoring = usePlayerStore(state => state.loading.stateRestoring);
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

  const handlePlayPause = useCallback(async () => {
    if (playbackState === 'playing') {
      await pause();
    } else {
      await play();
    }
  }, [playbackState, pause, play]);

  const handlePress = useCallback(() => {
    setSheetMode('full');
  }, [setSheetMode]);

  if (stateRestoring || !currentTrack) return null;

  const textColor = theme.colors.text;

  return (
    <Pressable onPress={handlePress} style={styles.row}>
      <ReciterImage
        reciterName={currentTrack.reciterName}
        style={styles.artwork}
      />

      <View style={styles.trackInfo}>
        <Text style={[styles.title, {color: textColor}]} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            {color: Color(textColor).alpha(0.5).toString()},
          ]}
          numberOfLines={1}>
          {currentTrack.artist}
        </Text>
      </View>

      <Pressable
        onPress={handlePlayPause}
        style={styles.playButton}
        hitSlop={10}>
        {isLoadingNewTrack ? (
          <LoadingIndicator color={textColor} />
        ) : playbackState === 'playing' ? (
          <PauseIcon color={textColor} size={22} />
        ) : (
          <PlayIcon color={textColor} size={22} />
        )}
      </Pressable>
    </Pressable>
  );
}

export const MiniPlayer: React.FC = React.memo(MiniPlayerInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 10,
  },
  artwork: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Manrope-SemiBold',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Manrope-Medium',
  },
  playButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
