import React, {useCallback, useMemo, useRef} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {expandPlayerSheet} from '@/services/player/sheetRef';
import {useMiniPlayerAnchor} from '@/components/player/v2/useMiniPlayerAnchor';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {ReciterImage} from '@/components/ReciterImage';
import Color from 'color';
// @ai-start
import {getTrackDisplayTitle, getTrackArtistDisplay} from '@/i18n/format';
import {usePlayerA11y} from '@/hooks/usePlayerA11y'; // @ai
// @ai-end

// Both dock variants (compact and expanded) use a 14 pt card radius.
const dockRadius = () => 14;

interface TabletDockedPlayerProps {
  /** When true, shows artwork + title + subtitle + play. When false, artwork-only compact mode. */
  expanded: boolean;
}

/**
 * Mini player docked inside the iPad sidebar footer.
 *
 * Phones never mount this component — they use `FloatingPlayer` (Android)
 * or `MiniPlayer` inside `NativeTabs.BottomAccessory` (iOS).
 */
// @ai-start
export const TabletDockedPlayer: React.FC<TabletDockedPlayerProps> = React.memo(
  function TabletDockedPlayer({expanded}) {
    const {theme} = useTheme();
    const a11y = usePlayerA11y(); // @ai
    const {play, pause} = usePlayerActions();
    const playbackState = usePlayerStore(state => state.playback.state);
    const queueTracks = usePlayerStore(state => state.queue.tracks);
    const currentIndex = usePlayerStore(state => state.queue.currentIndex);
    const trackLoading = usePlayerStore(state => state.loading.trackLoading);
    const stateRestoring = usePlayerStore(
      state => state.loading.stateRestoring,
    );
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

    // No swipe up: it doesn't fit a sidebar.
    const {anchorRef} = useMiniPlayerAnchor({radius: dockRadius});

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

    if (stateRestoring || !currentTrack) return null;

    // @ai-start
    // VoiceOver treats the whole dock as one element (the play button is
    // nested inside it), so expose play/pause as an action on the dock too.
    const isPlaying = playbackState === 'playing';
    const playPauseA11y = a11y.playPause(isPlaying);
    const dockA11y = {
      ...a11y.openPlayer(
        getTrackDisplayTitle(currentTrack),
        getTrackArtistDisplay(currentTrack),
      ),
      accessibilityActions: [
        {
          name: 'togglePlayback',
          label: playPauseA11y.accessibilityLabel ?? '',
        },
      ],
      onAccessibilityAction: (e: {nativeEvent: {actionName: string}}) => {
        if (e.nativeEvent.actionName === 'togglePlayback') handlePlayPause();
      },
    };
    // @ai-end

    const bg = Color(theme.colors.text).alpha(0.04).toString();
    const border = Color(theme.colors.text).alpha(0.08).toString();
    const textColor = Color(theme.colors.text).alpha(0.95).toString();
    const subtitleColor = Color(theme.colors.textSecondary)
      .alpha(0.55)
      .toString();

    if (!expanded) {
      return (
        <Pressable
          ref={anchorRef}
          onPress={handlePress}
          {...dockA11y} // @ai
          style={[styles.compact, {backgroundColor: bg, borderColor: border}]}>
          <ReciterImage
            reciterName={currentTrack.reciterName}
            style={styles.artworkCompact}
          />
          <Pressable
            onPress={handlePlayPause}
            {...playPauseA11y} // @ai
            hitSlop={8}
            style={styles.compactPlay}>
            {isLoadingNewTrack ? (
              <LoadingIndicator color={theme.colors.text} />
            ) : playbackState === 'playing' ? (
              <PauseIcon color={theme.colors.text} size={16} />
            ) : (
              <PlayIcon color={theme.colors.text} size={16} />
            )}
          </Pressable>
        </Pressable>
      );
    }

    return (
      <Pressable
        ref={anchorRef}
        onPress={handlePress}
        {...dockA11y} // @ai
        style={[styles.expanded, {backgroundColor: bg, borderColor: border}]}>
        <ReciterImage
          reciterName={currentTrack.reciterName}
          style={styles.artwork}
        />
        <View style={styles.trackInfo}>
          <Text style={[styles.title, {color: textColor}]} numberOfLines={1}>
            {getTrackDisplayTitle(currentTrack)}
          </Text>
          <Text
            style={[styles.subtitle, {color: subtitleColor}]}
            numberOfLines={1}>
            {getTrackArtistDisplay(currentTrack)}
          </Text>
        </View>
        <Pressable
          onPress={handlePlayPause}
          {...playPauseA11y} // @ai
          hitSlop={8}
          style={styles.playButton}>
          {isLoadingNewTrack ? (
            <LoadingIndicator color={theme.colors.text} />
          ) : playbackState === 'playing' ? (
            <PauseIcon color={theme.colors.text} size={20} />
          ) : (
            <PlayIcon color={theme.colors.text} size={20} />
          )}
        </Pressable>
      </Pressable>
    );
  },
);
// @ai-end

const styles = StyleSheet.create({
  compact: {
    width: 56,
    alignSelf: 'center',
    padding: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 6,
  },
  artworkCompact: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
  compactPlay: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expanded: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
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
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
